import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/wsimages.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'WSImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'WSImagesResponse' }
}

export const api: RouteApi = {
	endpoint: `wsimages`,
	methods: {
		get: payload,
		post: payload
	}
}
