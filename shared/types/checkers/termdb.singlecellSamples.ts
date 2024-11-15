import { createValidate } from 'typia'
import type {
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse
} from '../src/routes/termdb.singlecellSamples.ts'

export { termdbSingleCellSamplesPayload } from '../src/routes/termdb.singlecellSamples.ts'

export const validTermdbSingleCellSamplesRequest = createValidate<TermdbSingleCellSamplesRequest>()
export const validTermdbSingleCellSamplesResponse = createValidate<TermdbSingleCellSamplesResponse>()
