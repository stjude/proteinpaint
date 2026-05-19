import type { RoutePayload } from '#types'

export const genesetEnrichmentPayload: RoutePayload = {
	request: { typeId: 'GenesetEnrichmentRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GenesetEnrichmentResponse' }
}
