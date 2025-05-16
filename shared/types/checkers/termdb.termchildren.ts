// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermChildrenRequest, TermChildrenResponse } from '../src/routes/termdb.termchildren.ts'

export { termChildrenPayload } from '../src/routes/termdb.termchildren.ts'

export const validTermChildrenRequest = createValidate<TermChildrenRequest>()
export const validTermChildrenResponse = createValidate<TermChildrenResponse>()
