import { getResult } from '#src/gene.js'
import type { GeneLookupRequest, GeneLookupResponse, RouteApi } from '#types'
import { geneLookupPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'genelookup',
	methods: {
		get: {
			init,
			...geneLookupPayload
		},
		post: {
			init,
			...geneLookupPayload
		}
	}
}

function init({ genomes }) {
	return (req, res): void => {
		try {
			const q = req.query as GeneLookupRequest
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const result = getResult(g, q) as GeneLookupResponse
			res.send(result)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
