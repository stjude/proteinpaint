// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbSingleCellDataRequest, TermdbSingleCellDataResponse } from '../src/routes/termdb.singlecellData.ts'

export { termdbSingleCellDataPayload } from '../src/routes/termdb.singlecellData.ts'

export const validTermdbSingleCellDataRequest = createValidate<TermdbSingleCellDataRequest>()
export const validTermdbSingleCellDataResponse = createValidate<TermdbSingleCellDataResponse>()
