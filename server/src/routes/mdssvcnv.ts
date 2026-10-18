import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'
import { handle_mdssvcnv, setGenomes } from '#src/mds.svcnv.js'

/*
The route of the svcnv track of a legacy mds dataset, which was set up by app.unorg.js. The handler is in mds.svcnv.js.
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
	endpoint: 'mdssvcnv',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	setGenomes(genomes)
	return handle_mdssvcnv
}
