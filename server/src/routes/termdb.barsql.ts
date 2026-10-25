import type { RouteApi, RoutePayload } from '#types'
import { handle_request_closure } from '#src/termdb.barchart.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'

/*
The route of the termdb barchart data. The handler is in termdb.barchart.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'termdb/barsql',
	middlewares: [protectedRoutes.minSampleSize],
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return handle_request_closure(genomes)
}
