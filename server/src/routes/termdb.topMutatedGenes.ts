import type { RoutePayload } from '#types'

export const topMutatedGenePayload: RoutePayload = {
	request: { typeId: 'topMutatedGeneRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'topMutatedGeneResponse' }
}
