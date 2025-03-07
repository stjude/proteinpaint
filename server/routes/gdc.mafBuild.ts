import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import { run_rust_stream } from '@sjcrh/proteinpaint-rust'
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
	const boundary = 'GDC_MAF_MULTIPART_BOUNDARY_2025'
	res.setHeader('content-type', `multipart/mixed; boundary=${boundary}`)
	res.write(`--${boundary}`)
	res.write('\ncontent-disposition: attachment; filename=cohort.maf.gz')
	res.write('\ncontent-type: application/octet-stream\n\n')
	res.flush() // header text should be sent as a separate chunk from the content that will be streamed next

	const rustStream = run_rust_stream('gdcmaf', JSON.stringify(arg))
	rustStream.pipe(res, { end: false })

	rustStream.on('end', () => {
		res.write(`\n--${boundary}`)
		res.write('\ncontent-type: application/json')
		res.flush()
		res.write('\n\n' + JSON.stringify({ ok: true, status: 'ok', message: 'Processing complete' }))
		res.flush()
		res.write(`\n--${boundary}--`)
		// report amount of time taken to run rust
		mayLog('rust gdcmaf', Date.now() - t0)
		res.end()
	})

	rustStream.on('error', error => {
		res.write(`\n--${boundary}`)
		res.write('\ncontent-type: application/json')
		res.flush()
		res.write('\n\n' + JSON.stringify({ status: 'error', error }))
		res.flush()
		res.write(`\n--${boundary}--`)
		console.error(error)
		res.statusCode = 500
		res.end('Internal Server Error')
	})
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
