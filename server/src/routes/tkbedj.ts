import type { RouteApi, RoutePayload } from '#types'
import bedj_request_closure from '#src/bedj.js'

/*
The route of the bedj track. The handler is in bedj.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkbedj',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return bedj_request_closure(genomes)
}
