import type { RoutePayload } from '#types'

export const wsImagesPayload: RoutePayload = {
	request: { typeId: 'WSImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'WSImagesResponse' }
}
