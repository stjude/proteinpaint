// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbDmrRequest, TermdbDmrResponse } from '../src/routes/termdb.dmr.ts'

export { TermdbDmrPayload } from '../src/routes/termdb.dmr.ts'

export const validTermdbDmrRequest = createValidate<TermdbDmrRequest>()
export const validTermdbDmrResponse = createValidate<TermdbDmrResponse>()
