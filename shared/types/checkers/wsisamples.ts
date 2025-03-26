import { createValidate } from 'typia'
import type { WSISamplesRequest, WSISamplesResponse } from '../src/routes/wsisamples.ts'

export { wsiSamplesPayload } from '../src/routes/wsisamples.ts'

export const validWSISamplesRequest = createValidate<WSISamplesRequest>()
export const validWSSamplesResponse = createValidate<WSISamplesResponse>()
