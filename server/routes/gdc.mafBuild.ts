import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import { stream_rust } from '@sjcrh/proteinpaint-rust'
import type { GdcMafBuildRequest, RouteApi } from '#types'
import { gdcMafPayload } from '#types/checkers'
import { maxTotalSizeCompressed } from './gdc.maf.ts'
import { mayLog } from '#src/helpers.ts'

export const api: RouteApi = {
	endpoint: 'gdc/mafBuild',
	methods: {
		get: {
			init,
			...gdcMafPayload
		},
		post: {
			init,
			...gdcMafPayload
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: GdcMafBuildRequest = req.query
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
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
			status?: 'string'
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
	const { host } = ds.getHostHeaders(q)
	const fileLst2 = (await getFileLstUnderSizeLimit(q.fileIdLst, host)) as string[]

	mayLog(`${fileLst2.length} out of ${q.fileIdLst.length} input MAF files accepted by size limit`, Date.now() - t0)

	const arg = {
		fileIdLst: fileLst2,
		columns: q.columns,
		host: joinUrl(host.rest, 'data') // must use the /data/ endpoint from current host
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
		const rustStream = stream_rust('gdcmaf', JSON.stringify(arg), emitJson)
		if (rustStream) {
			rustStream.pipe(res, { end: false }).on('error', e => {
				if (!e) return
				console.log(e)
			})
		} else {
			emitJson({ error: 'server error: undefined rustStream' })
		}
	} catch (e) {
		console.log(e)
	}

	function emitJson(data?: EmitJsonDataArg, end: boolean = true) {
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
async function getFileLstUnderSizeLimit(lst: string[], host) {
	if (lst.length == 0) throw 'fileIdLst[] not array or blank'
	const body = {
		filters: {
			op: 'in',
			content: { field: 'file_id', value: lst }
		},
		size: 10000,
		fields: 'file_size'
	}

	const response = await ky.post(joinUrl(host.rest, 'files'), { timeout: false, json: body })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err

	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	const out = [] as string[]
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
