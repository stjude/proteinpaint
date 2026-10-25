import type { RouteApi, RoutePayload } from '#types'
import { handle_singlecell_closure } from '#src/singlecell.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the single cell data. The handler is in singlecell.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_legacysinglecell
	get init() {
		return serverconfig.features.disableFeature_legacysinglecell ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'singlecell',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return handle_singlecell_closure(genomes)
}
