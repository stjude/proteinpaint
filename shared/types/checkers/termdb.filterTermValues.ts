// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { FilterTermValuesRequest, FilterTermValuesResponse } from '../src/routes/termdb.filterTermValues.ts'

export { FilterTermValuesPayload } from '../src/routes/termdb.filterTermValues.ts'

export const validFilterTermValuesRequest = createValidate<FilterTermValuesRequest>()
export const validFilterTermValuesResponse = createValidate<FilterTermValuesResponse>()
