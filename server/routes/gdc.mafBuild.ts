import got from 'got'
import path from 'path'
import fs from 'fs'
import { run_rust_stream } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import Readable from 'stream'
import type { GdcMafBuildRequest } from '#routeTypes/gdc.mafBuild.ts'
import { maxTotalSizeCompressed } from './gdc.maf.ts'

export const api = {
	endpoint: 'gdc/mafBuild',
	methods: {
		all: {
			init,
			request: {
				typeId: 'GdcMafBuildRequest'
			},
			response: {
				typeId: null // 'GdcMafBuildResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
			await buildMaf(req.query as GdcMafBuildRequest, res, ds)
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
async function buildMaf(q: GdcMafBuildRequest, res: any, ds) {
	const t0 = Date.now()
	const { host, headers } = ds.getHostHeaders(q)
	const fileLst2 = (await getFileLstUnderSizeLimit(q.fileIdLst, host, headers)) as string[]

	if (serverconfig.debugmode)
		console.log(
			`${fileLst2.length} out of ${q.fileIdLst.length} input MAF files accepted by size limit`,
			Date.now() - t0
		)

	const arg = {
		fileIdLst: fileLst2,
		columns: q.columns,
		host: path.join(host.rest, 'data') // must use the /data/ endpoint from current host
	}

	const rustStream = run_rust_stream('gdcmaf', JSON.stringify(arg))
	res.setHeader('Content-Type', 'application/octet-stream')
	res.setHeader('Content-Disposition', 'attachment; filename=cohort.maf.gz')
	rustStream.pipe(res)

	rustStream.on('end', () => {
		// report amount of time taken to run rust
		if (serverconfig.debugmode) console.log('rust gdcmaf', Date.now() - t0)
		res.end()
	})

	rustStream.on('error', err => {
		console.error(err)
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
async function getFileLstUnderSizeLimit(lst: string[], host, headers) {
	if (lst.length == 0) throw 'fileIdLst[] not array or blank'
	const data = {
		filters: {
			op: 'in',
			content: { field: 'file_id', value: lst }
		},
		size: 10000,
		fields: 'file_size'
	}
	const response = await got.post(path.join(host.rest, 'files'), { headers, body: JSON.stringify(data) })
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid json from getFileLstUnderSizeLimit'
	}
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
