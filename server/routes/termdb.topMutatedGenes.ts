import type { topMutatedGeneRequest, topMutatedGeneResponse, RouteApi } from '#types'
import { topMutatedGenePayload } from '#types/checkers'
//import { mclasscnvgain, mclasscnvloss, dtsnvindel } from '#shared/common.js'

export const api: RouteApi = {
	endpoint: 'termdb/topMutatedGenes',
	methods: {
		get: {
			init,
			...topMutatedGenePayload
		},
		post: {
			init,
			...topMutatedGenePayload
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: topMutatedGeneRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw 'genome missing'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'ds missing'
			if (!ds.queries?.topMutatedGenes) throw 'not supported by ds'
			const genes = await ds.queries.topMutatedGenes.get(q)
			const payload: topMutatedGeneResponse = { genes }
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.trace(e)
		}
	}
}

export function validate_query_getTopMutatedGenes(ds: any, genome: any) {
	const q = ds.queries?.topMutatedGenes
	if (!q) return // ds not equipped
	if (typeof q.get == 'function') return // ds supplies the getter. done
	// add getter with builti in logic
	q.get = async (param: topMutatedGeneRequest) => {}
}
