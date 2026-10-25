import type { RouteApi, RoutePayload } from '#types'
import aicheck_request_closure from '#src/aicheck.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the aicheck track. The handler is in aicheck.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tkaicheck
	get init() {
		return serverconfig.features.disableFeature_tkaicheck ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkaicheck',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return aicheck_request_closure(genomes)
}
