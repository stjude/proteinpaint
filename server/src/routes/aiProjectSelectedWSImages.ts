import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/aiProjectSelectedWSImages.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'AiProjectSelectedWSImagesRequest' /*, checker: TODO write validator */ },
	response: { typeId: 'AiProjectSelectedWSImagesResponse' }
}

export const api: RouteApi = {
	endpoint: 'aiProjectSelectedWSImages',
	methods: {
		// This endpoint does not support write operation, the same readonly request/response
		// payload init/typeId/checker is expected for both GET and POST methods, where POST
		// is used when the request payload is to large to be encoded as URL parameters.
		// May switch to using HTTP QUERY method once that is stable and widely supported.
		get: payload,
		post: payload
	}
}
