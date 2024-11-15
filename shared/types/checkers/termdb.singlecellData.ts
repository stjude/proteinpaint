import { createValidate } from 'typia'
import type { TermdbSingleCellDataRequest, TermdbSingleCellDataResponse } from '../src/routes/termdb.singlecellData.ts'

export { termdbSingleCellDataPayload } from '../src/routes/termdb.singlecellData.ts'

export const validTermdbSingleCellDataRequest = createValidate<TermdbSingleCellDataRequest>()
export const validTermdbSingleCellDataResponse = createValidate<TermdbSingleCellDataResponse>()
