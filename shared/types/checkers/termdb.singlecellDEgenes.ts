// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	TermdbSingleCellDEgenesRequest,
	TermdbSingleCellDEgenesResponse
} from '../src/routes/termdb.singlecellDEgenes.ts'

export { termdbSingleCellDEgenesPayload } from '../src/routes/termdb.singlecellDEgenes.ts'

export const validTermdbSingleCellDEgenesRequest = createValidate<TermdbSingleCellDEgenesRequest>()
export const validTermdbSingleCellDEgenesResponse = createValidate<TermdbSingleCellDEgenesResponse>()
