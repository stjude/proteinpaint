import type { RoutePayload } from '#types'

export const sampleWSImagesPayload: RoutePayload = {
	request: { typeId: 'SampleWSImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'SampleWSImagesResponse' }
}
