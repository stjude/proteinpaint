import type { RoutePayload } from '#types'

export const genesetOverrepresentationPayload: RoutePayload = {
	request: { typeId: 'GenesetOverrepresentationRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GenesetOverrepresentationResponse' }
}
