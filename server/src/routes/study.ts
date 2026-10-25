import type { RouteApi, RoutePayload } from '#types'
import handle_study from '#src/handle_study.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the study file. The handler is in handle_study.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_legacystudy
	get init() {
		return serverconfig.features.disableFeature_legacystudy ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'study',
	methods: {
		post: payload
	}
}

function init() {
	return handle_study
}
