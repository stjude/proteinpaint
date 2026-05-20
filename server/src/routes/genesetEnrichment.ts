import type { RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import { init } from '../../routes/genesetEnrichment.ts'

export const api: RouteApi = {
	endpoint: 'genesetEnrichment',
	methods: {
		get: {
			...genesetEnrichmentPayload,
			init
		},
		post: {
			...genesetEnrichmentPayload,
			init
		}
	}
}
