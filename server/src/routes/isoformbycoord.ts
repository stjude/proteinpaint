import type { RouteApi, RoutePayload } from '#types'
import { handle_isoformbycoord, setGenomes } from '#src/isoformbycoord.js'

/*
The route of the isoforms at a genomic position, which was set up by app.unorg.js. The handler is in isoformbycoord.js.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'isoformbycoord',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	setGenomes(genomes)
	return handle_isoformbycoord
}
