import type { RouteApi, RoutePayload } from '#types'
import { mds3_request_closure } from '#src/mds3.load.js'

/*
The route of the mds3 track, formerly /mds3. The handler is in mds3.load.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbMds3Request' },
	response: { typeId: 'TermdbMds3Response' }
}

export const api: RouteApi = {
	endpoint: 'termdb/mds3',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return mds3_request_closure(genomes)
}
