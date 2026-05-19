import type { RoutePayload } from '#types'

export const geneRankingPayload: RoutePayload = {
	request: { typeId: 'GeneRankingRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GeneRankingResponse' }
}
