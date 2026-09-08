import type { RouteApi, RoutePayload } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { get_matrix } from '#src/termdb.get_matrix.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbMatrixRequest' },
	response: { typeId: 'TermdbMatrixResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/matrix',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }: any) {
	return async (req: any, res: any) => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			if (!ds) throw 'invalid dslabel'
			return await get_matrix(q, req, res, ds, genome)
		} catch (e: any) {
			if (!res.headersSent) res.send({ error: e.message || e })
			if (e?.stack) console.log(e.stack)
		}
	}
}
