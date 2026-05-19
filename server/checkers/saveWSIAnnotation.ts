import type { RoutePayload } from '#types'

export const saveWSIAnnotationPayload: RoutePayload = {
	request: { typeId: 'SaveWSIAnnotationRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'SaveWSIAnnotationResponse' }
}
