// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { HicdataRequest, HicdataResponse } from '../src/routes/hicdata.ts'

export { hicdataPayload } from '../src/routes/hicdata.ts'

export const validHicdataRequest = createValidate<HicdataRequest>()
export const validHicdataResponse = createValidate<HicdataResponse>()
