import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/brainImaging.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'BrainImagingRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BrainImagingResponse' }
}

export const api: RouteApi = {
	endpoint: 'brainImaging',
	methods: {
		get: payload,
		post: payload
	}
}
