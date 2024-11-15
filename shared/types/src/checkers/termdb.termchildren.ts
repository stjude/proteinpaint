import { createValidate } from 'typia'
import type { TermChildrenRequest, TermChildrenResponse } from '../routes/termdb.termchildren.ts'

export { termChildrenPayload } from '../routes/termdb.termchildren.ts'

export const validTermChildrenRequest = createValidate<TermChildrenRequest>()
export const validTermChildrenResponse = createValidate<TermChildrenResponse>()
