import { createValidate } from 'typia'
import type { DsDataRequest, DsDataResponse } from '../routes/dsdata.ts'

export { dsDataPayload } from '../routes/dsdata.ts'

export const validDsDataRequest = createValidate<DsDataRequest>()
export const validDsDataResponse = createValidate<DsDataResponse>()
