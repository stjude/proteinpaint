import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/genesetEnrichment.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GenesetEnrichmentRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GenesetEnrichmentResponse' }
}

export const api: RouteApi = {
	endpoint: 'genesetEnrichment',
	methods: {
		get: payload,
		post: payload
	}
}
