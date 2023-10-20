import { GdcMafBuildResponse } from '#shared/types/routes/gdc.mafBuild.ts'
import path from 'path'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

export const api = {
	endpoint: 'gdc/mafBuild',
	methods: {
		all: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const result = await buildMaf(req)
						const payload = { result } as GdcMafBuildResponse
						res.send(payload)
					} catch (e: any) {
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
*/
async function buildMaf(req: any) {
	if (!Array.isArray(req.query.fileIdLst) || req.query.fileIdLst.length == 0) throw 'fileIdLst[] not array or blank'

	// call rust with fileIdLst

	return { fileSize: 1000 }
}
