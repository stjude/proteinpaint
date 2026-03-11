// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbGpdmRequest, TermdbGpdmResponse } from '../src/routes/termdb.gpdm.ts'

export { TermdbGpdmPayload } from '../src/routes/termdb.gpdm.ts'

export const validTermdbGpdmRequest = createValidate<TermdbGpdmRequest>()
export const validTermdbGpdmResponse = createValidate<TermdbGpdmResponse>()
