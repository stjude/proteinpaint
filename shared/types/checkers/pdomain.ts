import { createValidate } from 'typia'
import type { PdomainRequest, PdomainResponse } from '../src/routes/pdomain.ts'

export { pdomainPayload } from '../src/routes/pdomain.ts'

export const validPdomainRequest = createValidate<PdomainRequest>()
export const validPdomainResponse = createValidate<PdomainResponse>()
