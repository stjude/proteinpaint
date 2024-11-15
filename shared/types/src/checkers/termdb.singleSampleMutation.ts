import { createValidate } from 'typia'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../routes/termdb.singleSampleMutation.ts'

export { termdbSingleSampleMutationPayload } from '../routes/termdb.singleSampleMutation.ts'

export const validTermdbSingleSampleMutationRequest = createValidate<TermdbSingleSampleMutationRequest>()
export const validTermdbSingleSampleMutationResponse = createValidate<TermdbSingleSampleMutationResponse>()
