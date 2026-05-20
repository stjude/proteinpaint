import type { RoutePayload } from '#types'

export const brainImagingPayload: RoutePayload = {
	request: { typeId: 'BrainImagingRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BrainImagingResponse' }
}
