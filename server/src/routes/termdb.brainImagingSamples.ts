import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/brainImagingSamples.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'BrainImagingSamplesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BrainImagingSamplesResponse' }
}

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'termdb/brainImagingSamples',
	methods: {
		get: payload,
		// dofetch3 converts a long GET (e.g. a multivalue-term filter) into a POST of the same route
		post: payload
	}
}
