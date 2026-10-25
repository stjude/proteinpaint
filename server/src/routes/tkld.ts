import type { RouteApi, RoutePayload } from '#types'
import { handle_tkld } from '#src/ld.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the ld track. The handler is in ld.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tkld
	get init() {
		return serverconfig.features.disableFeature_tkld ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tkld',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return handle_tkld(genomes)
}
