import type { RoutePayload, RouteApi } from '#types'
import { init } from '#src/brainImaging/brainImaging.ts'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.queries.NIdata
	get init() {
		return hasNIdataDs(genomes) ? init : null
	},
	request: { typeId: 'BrainImagingRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BrainImagingResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/brainImaging',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasNIdataDs(genomes) {
	return Object.values(genomes).some((g: any) => Object.values(g.datasets || {}).some((ds: any) => ds.queries?.NIdata))
}
