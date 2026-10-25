import type { RouteApi, RoutePayload } from '#types'
import bam_request_closure from '#src/bam.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the bam track. The handler is in bam.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tkbam
	get init() {
		return serverconfig.features.disableFeature_tkbam ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkbam',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return bam_request_closure(genomes)
}
