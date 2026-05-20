import type { RoutePayload } from '#types'

export const aiProjectSelectedWSImagesPayload: RoutePayload = {
	request: { typeId: 'AiProjectSelectedWSImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'AiProjectSelectedWSImagesResponse' }
}
