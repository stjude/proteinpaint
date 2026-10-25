import type { RouteApi, RoutePayload } from '#types'
import bampile_request_closure from '#src/bampile.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the bampile track. The handler is in bampile.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tkbampile
	get init() {
		return serverconfig.features.disableFeature_tkbampile ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkbampile',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return bampile_request_closure(genomes)
}
