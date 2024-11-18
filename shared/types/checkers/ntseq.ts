import { createValidate } from 'typia'
import type { NtseqRequest, NtseqResponse } from '../src/routes/ntseq.ts'

export { ntseqPayload } from '../src/routes/ntseq.ts'

export const validNtseqRequest = createValidate<NtseqRequest>()
export const validNtseqResponse = createValidate<NtseqResponse>()
