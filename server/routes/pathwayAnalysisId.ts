import * as utils from '../src/utils.js'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { PathwayAnalysisIdRequest, PathwayAnalysisIdResponse, RouteApi } from '#types'

/*
given one or more compound names/ids, return the KEGG id
*/

export const api: RouteApi = {
	endpoint: 'pathwayAnalysisId',
	methods: {
		get: {
			init,
			request: {
				typeId: 'PathwayAnalysisIdRequest'
			},
			response: {
				typeId: 'PathwayAnalysisIdResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query: PathwayAnalysisIdRequest = req.query
			const ids = await getPathwayAnalysisId(query, genomes)
			res.send(ids satisfies PathwayAnalysisIdResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Pathway analysis id not found')
		}
	}
}

async function dbQ(dbfile) {
	let db
	try {
		console.log('Connecting', dbfile)
		db = utils.connect_db(dbfile)
	} catch (e) {
		throw `Cannot connect to db: ${compdbfile}: ${e}`
	}
	const dbQuery = {
		getkeggbycompd: db.prepare('select kegg_id from compound where name=? COLLATE NOCASE'),
		getnamebyalias: db.prepare('select name from compoundalias where alias=? COLLATE NOCASE')
	}
	return dbQuery
}

async function getPathwayAnalysisId(query: PathwayAnalysisIdRequest, genomes: any): Promise<PathwayAnalysisIdResponse> {
	const g = genomes[query.genome]
	if (!g) throw 'invalid genome name'
	const ds = g.datasets[query.dslabel]
	if (!ds) throw 'invalid dataset name'
	const compdbfile = ds.queries.compounddb.dbfile
	if (!compdbfile) throw 'no compound db file'
	const compdbfilePath = path.join(serverconfig.tpmasterdir, compdbfile)
	// connect db
	const dbQuery = await dbQ(compdbfilePath)
	const keggids = {}
	for (const comp of query.comlst) {
		// input is compound name or alias
		if (query.selecti === 0) {
			let id = dbQuery.getkeggbycompd.get(comp)
			if (!id) {
				const cnam = dbQuery.getnamebyalias.get(comp)
				if (cnam) {
					id = dbQuery.getkeggbycompd.get(cnam.name)
				}
			}
			if (id) {
				keggids[comp] = id.kegg_id
			}
		}
	}
	return { keggids }
}
