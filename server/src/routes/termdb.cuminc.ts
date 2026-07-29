import { get_incidence } from '#src/termdb.cuminc.js'
import type { RouteApi, RoutePayload } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbCumincRequest' },
	response: { typeId: 'TermdbCumincResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cuminc',
	methods: {
		get: payload,
		post: payload
	}
}

export async function get_cuminc(q: any, ds: any) {
	return await get_incidence(q, ds)
}

function init({ genomes }: any) {
	return async (req: any, res: any) => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel] || genome.termdbs?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const data = await get_cuminc(q, ds)
			res.send(data)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e?.stack) console.log(e.stack)
			else console.log(e)
		}
	}
}
