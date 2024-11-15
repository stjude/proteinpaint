import { createValidate } from 'typia'
import type {
	TermdbSingleCellDEgenesRequest,
	TermdbSingleCellDEgenesResponse
} from '../routes/termdb.singlecellDEgenes.ts'

export { termdbSingleCellDEgenesPayload } from '../routes/termdb.singlecellDEgenes.ts'

export const validTermdbSingleCellDEgenesRequest = createValidate<TermdbSingleCellDEgenesRequest>()
export const validTermdbSingleCellDEgenesResponse = createValidate<TermdbSingleCellDEgenesResponse>()
