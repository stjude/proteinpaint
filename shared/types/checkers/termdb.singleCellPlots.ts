// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	TermdbSingleCellPlotsRequest,
	TermdbSingleCellPlotsResponse
} from '../src/routes/termdb.singleCellPlots.ts'

export { termdbSingleCellPlotsPayload } from '../src/routes/termdb.singleCellPlots.ts'

export const validTermdbSingleCellPlotsRequest = createValidate<TermdbSingleCellPlotsRequest>()
export const validTermdbSingleCellPlotsResponse = createValidate<TermdbSingleCellPlotsResponse>()
