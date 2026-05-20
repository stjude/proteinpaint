import type { RoutePayload } from '#types'
import { getResult } from '#src/gene.js'
import type { GeneLookupRequest, GeneLookupResponse, RouteApi } from '#types'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'GeneLookupRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GeneLookupResponse' }
}

export const api: RouteApi = {
	endpoint: 'genelookup',
	methods: {
		// This endpoint does not support write operation, the same readonly request/response
		// payload init/typeId/checker is expected for both GET and POST methods, where POST
		// is used when the request payload is to large to be encoded as URL parameters.
		// may switch to using HTTP QUERY method once that is stable and widely supported
		get: payload,
		post: payload
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
