import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'
import { handle_mdsgenevalueonesample, setGenomes } from '#src/mds.genevalueonesample.js'

/*
The route of the gene values of one sample of a legacy mds dataset, which was set up by app.unorg.js. The handler is in mds.genevalueonesample.js.
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
	endpoint: 'mdsgenevalueonesample',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	setGenomes(genomes)
	return handle_mdsgenevalueonesample
}
