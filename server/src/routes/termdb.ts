import type { RouteApi, RoutePayload } from '#types'
import { handle_request_closure } from '#src/termdb.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'

/*
The legacy termdb route. The handler is in termdb.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'termdb',
	// the handler calls authApi.canDisplaySampleIds() for the q.for sample data requests
	middlewares: [protectedRoutes.samples],
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return handle_request_closure(genomes)
}
