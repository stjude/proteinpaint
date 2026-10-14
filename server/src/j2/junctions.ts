import type { RouteApi, RoutePayload, TermdbJunctionsRequest, TermdbJunctionsResponse } from '#types'
import { genomes } from '#src/initGenomesDs.js'

/*
list junctions from a locus
*/

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one mds3 ds has a junction query
	get init() {
		return hasJunctionDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbJunctionsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbJunctionsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/junctions',
	methods: {
		get: payload,
		post: payload
	}
}

/*
returns true when any loaded mds3 ds from any genome has .queries.junction
legacy mds ds may also have .queries.junction (type=mdsjunction) but are not served by j2 routes
*/
export function hasJunctionDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.isMds3 && ds.queries?.junction)
	)
}

export function init({ genomes }) {
	return async (req, res) => {
		try {
			const q: TermdbJunctionsRequest = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'
			const ds = gn.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.junction) throw 'junction query not supported'
			const result = await ds.queries.junction.listJunctions(q)
			res.send(result satisfies TermdbJunctionsResponse)
		} catch (e: any) {
			res.send({ status: e.status || 400, error: e.message || String(e) } satisfies TermdbJunctionsResponse)
			if (e.stack) console.log(e.stack)
		}
	}
}
