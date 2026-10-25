import type { RouteApi, RoutePayload } from '#types'
import { gdc_bam_request } from '#src/bam.gdc.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the gdc bam file lookup. The handler is in bam.gdc.js.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_gdcbam
	get init() {
		return serverconfig.features.disableFeature_gdcbam ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'gdcbam',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return gdc_bam_request(genomes)
}
