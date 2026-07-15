import type { RouteApi, RoutePayload, TermdbJunctionsRequest, TermdbJunctionsResponse } from '#types'

/*
list junctions from a locus
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbJunctionsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbJunctionsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/junctions',
	methods: {
		get: payload
	}
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
