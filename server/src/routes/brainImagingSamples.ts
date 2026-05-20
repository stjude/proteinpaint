import type { RoutePayload } from '#types'

export const brainImagingSamplesPayload: RoutePayload = {
	request: { typeId: 'BrainImagingSamplesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BrainImagingSamplesResponse' }
}
