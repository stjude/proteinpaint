import type { RoutePayload } from '#types'

export const aiProjectTrainModelPayload: RoutePayload = {
	request: { typeId: 'AIProjectTrainModelRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'AIProjectTrainModelResponse' }
}
