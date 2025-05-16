// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	GenesetOverrepresentationRequest,
	GenesetOverrepresentationResponse
} from '../src/routes/genesetOverrepresentation.ts'

export { genesetOverrepresentationPayload } from '../src/routes/genesetOverrepresentation.ts'

export const validGenesetOverrepresentationRequest = createValidate<GenesetOverrepresentationRequest>()
export const validGenesetOverrepresentationResponse = createValidate<GenesetOverrepresentationResponse>()
