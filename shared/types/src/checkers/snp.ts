import { createValidate } from 'typia'
import type { SnpRequest, SnpResponse } from '../routes/snp.ts'

export { snpPayload } from '../routes/snp.ts'

export const validSnpRequest = createValidate<SnpRequest>()
export const validSnpResponse = createValidate<SnpResponse>()
