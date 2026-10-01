import type { RoutePayload, topMutatedGeneRequest, topMutatedGeneResponse, RouteApi } from '#types'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated (this module is also imported by mds3.init.js, which is imported by initGenomesDs.js);
	// the route is only set up when at least one ds has ds.queries.topMutatedGenes
	get init() {
		return hasTopMutatedGenesDs(genomes) ? init : null
	},
	request: { typeId: 'topMutatedGeneRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'topMutatedGeneResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/topMutatedGenes',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasTopMutatedGenesDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.queries?.topMutatedGenes)
	)
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

export function validate_query_getTopMutatedGenes(ds: any) {
	const q = ds.queries?.topMutatedGenes
	if (!q) return // ds not equipped
	// only api-based ds (e.g. gdc) supply this getter; native ds should use grin2 instead
	if (typeof q.get != 'function') throw 'queries.topMutatedGenes.get() is not a function'
}
