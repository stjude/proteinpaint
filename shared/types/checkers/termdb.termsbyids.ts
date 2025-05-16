// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermsByIdsRequest, TermsByIdsResponse } from '../src/routes/termdb.termsbyids.ts'

export { termsByIdsPayload } from '../src/routes/termdb.termsbyids.ts'

export const validTermsByIdsRequest = createValidate<TermsByIdsRequest>()
export const validTermsByIdsResponse = createValidate<TermsByIdsResponse>()
