import got from 'got'
import path from 'path'
import fs from 'fs'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const maxTotalSizeCompressed = serverconfig.features.gdcMafMaxFileSize || 50000000 // 50Mb

export const api = {
	endpoint: 'gdc/mafBuild',
	methods: {
		all: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						await buildMaf(req, res)
					} catch (e) {
						if (e.stack) console.log(e.stack)
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: null
				//valid: default to type checker
			},
			response: {
				typeId: 'GdcMafBuildResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

/*
req.query {
	fileIdLst []  // list of maf file uuids
}

res{}
*/
async function buildMaf(req: any, res: any) {
	const fileLst2 = (await getFileLstUnderSizeLimit(req.query.fileIdLst)) as string[]

	const outFile = path.join(serverconfig.cachedir, 'gdcMaf.' + Math.random().toString()) // should be a gzipped file. does it need to end with '.gz' or it's auto-added?

	const arg = {
		fileIdLst: fileLst2,
		host: path.join(apihost, 'data'), // must use the /data/ endpoint from current host
		outFile
	}

	await run_rust('gdcmaf', JSON.stringify(arg))

	const data = await fs.promises.readFile(outFile)

	// by directly returning a blob, it won't tell client how many files are used

	res.writeHead(200, {
		'Content-Type': 'application/octet-stream',
		'Content-Disposition': 'attachment; filename=cohort.maf.gz',
		'Content-Length': data.length
	})
	res.end(Buffer.from(data, 'binary'))
}

/*
query api get size of each input maf file, and only process those files with total size under a set limit,
excess files are not processed in order not to crash server
must not rely on file size sent by client, as that can be spoofed and never to be trusted
it's inexpensive to query api for this
*/
async function getFileLstUnderSizeLimit(lst: string[]) {
	if (lst.length == 0) throw 'fileIdLst[] not array or blank'
	const data = {
		filters: {
			op: 'in',
			content: { field: 'file_id', value: lst }
		},
		size: 1000,
		fields: 'file_size'
	}
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	const response = await got.post(path.join(apihost, 'files'), { headers, body: JSON.stringify(data) })
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
