import type { RoutePayload } from '#types'

export const clearWSImagesSessionsPayload: RoutePayload = {
	request: { typeId: 'ClearWSImagesSessionsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ClearWSImagesSessionsResponse' }
}
