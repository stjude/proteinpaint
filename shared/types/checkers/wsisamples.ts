// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { WSISamplesRequest, WSISamplesResponse } from '../src/routes/wsisamples.ts'

export { wsiSamplesPayload } from '../src/routes/wsisamples.ts'

export const validWSISamplesRequest = createValidate<WSISamplesRequest>()
export const validWSISamplesResponse = createValidate<WSISamplesResponse>()
