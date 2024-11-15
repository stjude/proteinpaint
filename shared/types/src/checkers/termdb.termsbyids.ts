import { createValidate } from 'typia'
import type { TermsByIdsRequest, TermsByIdsResponse } from '../routes/termdb.termsbyids.ts'

export { termsByIdsPayload } from '../routes/termdb.termsbyids.ts'

export const validTermsByIdsRequest = createValidate<TermsByIdsRequest>()
export const validTermsByIdsResponse = createValidate<TermsByIdsResponse>()
