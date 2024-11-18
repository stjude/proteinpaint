import { createValidate } from 'typia'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse
} from '../src/routes/termdb.singleSampleMutation.ts'

export { termdbSingleSampleMutationPayload } from '../src/routes/termdb.singleSampleMutation.ts'

export const validTermdbSingleSampleMutationRequest = createValidate<TermdbSingleSampleMutationRequest>()
export const validTermdbSingleSampleMutationResponse = createValidate<TermdbSingleSampleMutationResponse>()
