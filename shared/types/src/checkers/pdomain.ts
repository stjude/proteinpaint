import { createValidate } from 'typia'
import type { PdomainRequest, PdomainResponse } from '../routes/pdomain.ts'

export { pdomainPayload } from '../routes/pdomain.ts'

export const validPdomainRequest = createValidate<PdomainRequest>()
export const validPdomainResponse = createValidate<PdomainResponse>()
