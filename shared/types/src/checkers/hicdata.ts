import { createValidate } from 'typia'
import type { HicdataRequest, HicdataResponse } from '../routes/hicdata.ts'

export { hicdataPayload } from '../routes/hicdata.ts'

export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
