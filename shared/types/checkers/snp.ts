import { createValidate } from 'typia'
import type { SnpRequest, SnpResponse } from '../src/routes/snp.ts'

export { snpPayload } from '../src/routes/snp.ts'

export const validSnpRequest = createValidate<SnpRequest>()
export const validSnpResponse = createValidate<SnpResponse>()
