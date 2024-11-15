import { createValidate } from 'typia'
import type {
	GenesetOverrepresentationRequest,
	GenesetOverrepresentationResponse
} from '../routes/genesetOverrepresentation.ts'

export { genesetOverrepresentationPayload } from '../routes/genesetOverrepresentation.ts'

export const validGenesetOverrepresentationRequest = createValidate<GenesetOverrepresentationRequest>()
export const validGenesetOverrepresentationResponse = createValidate<GenesetOverrepresentationResponse>()
