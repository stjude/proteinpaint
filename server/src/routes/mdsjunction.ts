import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'
import { mdsjunction_request_closure } from '#src/mds.junction.js'

/*
The route of the junction track of a legacy mds dataset. The handler is in mds.junction.js.
*/

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module is evaluated;
	// the route is only set up when a loaded genome has a legacy mds dataset
	get init() {
		return hasMdsDataset(genomes) ? init : null
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'mdsjunction',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return mdsjunction_request_closure(genomes)
}
