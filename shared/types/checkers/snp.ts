// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { SnpRequest, SnpResponse } from '../src/routes/snp.ts'

export { snpPayload } from '../src/routes/snp.ts'

export const validSnpRequest = createValidate<SnpRequest>()
export const validSnpResponse = createValidate<SnpResponse>()
