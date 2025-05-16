// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse } from '../src/routes/genesetEnrichment.ts'

export { genesetEnrichmentPayload } from '../src/routes/genesetEnrichment.ts'

export const validGenesetEnrichmentRequest = createValidate<GenesetEnrichmentRequest>()
export const validGenesetEnrichmentResponse = createValidate<GenesetEnrichmentResponse>()
