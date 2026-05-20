import type { RoutePayload } from '#types'

export const dzImagesPayload: RoutePayload = {
	request: { typeId: 'DZImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DZImagesResponse' }
}
