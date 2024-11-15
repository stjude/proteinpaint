import { createValidate } from 'typia'
import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse } from '../routes/genesetEnrichment.ts'

export { genesetEnrichmentPayload } from '../routes/genesetEnrichment.ts'

export const validGenesetEnrichmentRequest = createValidate<GenesetEnrichmentRequest>()
export const validGenesetEnrichmentResponse = createValidate<GenesetEnrichmentResponse>()
