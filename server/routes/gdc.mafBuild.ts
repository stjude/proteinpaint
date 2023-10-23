//import { GdcMafBuildResponse } from '#shared/types/routes/gdc.mafBuild.ts'
import path from 'path'
import fs from 'fs'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

export const api = {
	endpoint: 'gdc/mafBuild',
	methods: {
		all: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						await buildMaf(req, res)
						/*
						const result = await buildMaf(req)
						const payload = { result } as GdcMafBuildResponse
						res.send(payload)
						*/
					} catch (e) {
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
	if (!Array.isArray(req.query.fileIdLst) || req.query.fileIdLst.length == 0) throw 'fileIdLst[] not array or blank'

	const outFile = path.join(serverconfig.cachedir, 'gdcMaf.' + Math.random().toString()) // should be a gzipped file. does it need to end with '.gz' or it's auto-added?

	const arg = {
		fileIdLst: req.query.fileIdLst,
		host: path.join(apihost, 'data'), // must use the /data/ endpoint from current host
		outFile
	}

	await run_rust('gdcmaf', JSON.stringify(arg))

	const data = await fs.promises.readFile(outFile)

	res.writeHead(200, {
		'Content-Type': 'application/octet-stream',
		'Content-Disposition': 'attachment; filename=cohort.maf.gz',
		'Content-Length': data.length
	})
	res.end(Buffer.from(data, 'binary'))
}
