import type { RoutePayload } from '#types'

export const termdbSampleImagesPayload: RoutePayload = {
	request: { typeId: 'TermdbSampleImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSampleImagesResponse' }
}
