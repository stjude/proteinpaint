import { createValidate } from 'typia'
import { WSISamplesRequest, WSISamplesResponse } from '../src/routes/wsisamples.ts'

export { wsiSamplesPayload } from '../src/routes/wsisamples.ts'

export const validWSISamplesRequest = createValidate<WSISamplesRequest>()
export const validWSSamplesResponse = createValidate<WSISamplesResponse>()
