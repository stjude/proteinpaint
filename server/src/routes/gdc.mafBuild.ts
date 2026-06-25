import type { RoutePayload, RouteApi } from '#types'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import { stream_rust } from '@sjcrh/proteinpaint-rust'
import type { GdcMafBuildRequest } from '#types'
import { maxTotalSizeCompressed } from './gdc.maf.ts'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '#src/serverconfig.js'

// watchdog kill threshold (ms) for the gdcmaf rust process; a safety backstop against a
// hung/leaked download. Defaults to 5 minutes; overridable via serverconfig for slower
// GDC environments (e.g. qa-int) where a legitimate large download may need more time.
const gdcMafMaxElapsed = serverconfig.features.gdcMafMaxElapsed || 300000 // 5 min

// number of MAF files the gdcmaf rust tool downloads concurrently. Defaults to 20 (matching the
// gdcGRIN2 downloader); overridable via serverconfig to dial down for stricter GDC environments
// (e.g. qa-int, which appears to cap simultaneous connections) without a rebuild.
const gdcMafConcurrency = serverconfig.features.gdcMafConcurrency || 20

export const GdcMafPayload: RoutePayload = {
	init,
	request: { typeId: 'GdcMafBuildRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafBuildResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/mafBuild',
	methods: {
		get: GdcMafPayload,
		post: GdcMafPayload
	}
}

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
			const q: GdcMafBuildRequest = req.query
			await buildMaf(q, res, ds)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

type EmitJsonDataArg =
	| string
	| {
			status?: string
			ok?: boolean
			error?: string
			errors?: any[]
			message?: string
	  }

/*
q{}
res{}
*/
async function buildMaf(q: GdcMafBuildRequest, res, ds) {
	const t0 = Date.now()
	const { host, headers } = ds.getHostHeaders(q)
	const fileLst2: string[] = await getFileLstUnderSizeLimit(q.fileIdLst, host, headers)

	mayLog(`${fileLst2.length} out of ${q.fileIdLst.length} input MAF files accepted by size limit`, Date.now() - t0)

	// getHostHeaders() returns headers tuned for the JSON metadata API calls (ky): they include
	// `connection: close` plus Content-Type/Accept: application/json. Those must NOT be forwarded
	// onto the binary /data/<uuid> file downloads done by the rust tool: `connection: close`
	// defeats keep-alive and forces a brand-new connection per file, and the application/json
	// content-negotiation is wrong for a gzip download. Against a stricter GDC environment
	// (e.g. qa-int, behind a proxy/WAF) this can cause all but the first concurrent download to
	// be rejected. Forward only what a download needs: auth, plus the end user's real User-Agent
	// (passed in from the route handler) so GDC's proxy/WAF sees the actual client.
	const downloadHeaders: { [key: string]: string } = {}
	for (const [k, v] of Object.entries(headers)) {
		const lk = k.toLowerCase()
		if (lk === 'cookie' || lk === 'x-auth-token' || lk.startsWith('x-forwarded')) downloadHeaders[k] = v as string
	}

	const arg = {
		fileIdLst: fileLst2,
		columns: q.columns,
		host: joinUrl(host.rest, 'data'), // must use the /data/ endpoint from current host
		headers: downloadHeaders,
		concurrency: gdcMafConcurrency
	}
	// uncomment for manual error testing
	// const arg = {"host": "https://api.gdc.cancer.gov/data/","columns": ["Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", "Start_Position"], "fileIdLst": ["8b31d6d1-56f7-4aa8-b026-c64bafd531e7", "83ea587b-1e92-41b3-a8e3-12df30496724"]};

	const boundary = '------------------------GDC-MAF-BUILD'
	res.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`)
	res.write(`--${boundary}`)
	res.write('\r\nContent-Disposition: form-data; name="gzfile"; filename="cohort.maf.gz"')
	res.write('\r\nContent-Type: application/gzip\r\n\r\n')
	res.flush() // header text should be sent as a separate chunk from the content that will be streamed next

	try {
		const streams = stream_rust('gdcmaf', JSON.stringify(arg), emitJson, { maxElapsed: gdcMafMaxElapsed })
		if (streams) {
			const { rustStream, endStream } = streams
			// Important: rustStream.pipe(res, { end: false }) may cause a stalemate
			// where the spawned rust process, stream transform, and res instance
			// wait on each other to trigger a "stop", but does not happen automatically
			// when a browser tab is refreshed during a file download
			res.on('close', () => {
				if (res.writableEnded) return
				try {
					console.log('\n-- forced res.end() ---\n')
					res.end()
				} catch (e) {
					console.log('error with forced res.end()', e)
				}

				try {
					endStream()
				} catch (e) {
					console.log('error in calling endStream()', e)
				}
			})

			rustStream
				.pipe(res, { end: false })
				.on('error', e => {
					// this is not triggered when a request is disconnected
					console.log('rustStream.pipe().on(error)', e)
				})
				.on('end', () => {
					if (res.writableEnded) return
					console.log('rustStream.on(end), trigger res.end()')
					res.end()
				})
		} else {
			emitJson({ error: 'server error: undefined rustStream' })
		}
	} catch (e) {
		console.log('error calling stream_rust(gdcmaf)', e)
	}

	function emitJson(data?: EmitJsonDataArg, end: boolean = true) {
		if (res.writableEnded) return
		if (data) {
			res.write(`\r\n--${boundary}`)
			res.write('\r\nContent-Disposition: form-data; name="errors"')
			res.write('\r\nContent-Type: application/x-jsonlines')
			const json = typeof data === 'string' ? data : JSON.stringify(data || { ok: true, status: 'ok' })
			res.write('\r\n\r\n' + json)
		}
		res.write(`\r\n--${boundary}--\r\n`)
		// report amount of time taken to run rust
		mayLog('rust gdcmaf', Date.now() - t0)
		if (end) res.end()
	}

	// const rustStream = stream_rust('gdcmaf', JSON.stringify(arg))
	// const form = new FormData({ maxDataSize: 120 * 1024 * 1024 }) // file size in in MB
	// res.setHeader('content-type', `multipart/form-data; boundary=${form.getBoundary()}`)
	// form.append('gzfile', rustStream.stdout, { filename: 'test.gz' })
	// form.append('errors', rustStream.stderr, { contentType: 'application/x-jsonlines' })
	// form.pipe(res)
}

/*
query api get size of each input maf file, and only process those files with total size under a set limit,
excess files are not processed in order not to crash server
must not rely on file size sent by client, as that can be spoofed and never to be trusted
it's inexpensive to query api for this
*/
async function getFileLstUnderSizeLimit(lst: string[], host, headers) {
	if (lst.length == 0) throw 'fileIdLst[] not array or blank'
	const body = {
		filters: {
			op: 'in',
			content: { field: 'file_id', value: lst }
		},
		size: 10000,
		fields: 'file_size'
	}

	const response = await ky.post(joinUrl(host.rest, 'files'), { headers, timeout: false, json: body })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err

	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	const out: string[] = []
	let cumsize = 0
	for (const h of re.data.hits) {
		if (cumsize >= maxTotalSizeCompressed) break // maxed out
		if (!h.id) throw '.id missing'
		if (!Number.isInteger(h.file_size)) throw '.file_size not integer'
		cumsize += h.file_size
		out.push(h.id)
	}
	if (out.length == 0) throw 'no file available'
	return out
}
