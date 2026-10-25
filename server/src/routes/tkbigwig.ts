import type { RouteApi, RoutePayload } from '#types'
import bw_request_closure from '#src/bw.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the bigwig track. The handler is in bw.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tkbigwig
	get init() {
		return serverconfig.features.disableFeature_tkbigwig ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkbigwig',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return bw_request_closure(genomes)
}
