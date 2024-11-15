import { createValidate } from 'typia'
import type { DsDataRequest, DsDataResponse } from '../src/routes/dsdata.ts'

export { dsDataPayload } from '../src/routes/dsdata.ts'

export const validDsDataRequest = createValidate<DsDataRequest>()
export const validDsDataResponse = createValidate<DsDataResponse>()
