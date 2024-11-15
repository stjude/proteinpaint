import { createValidate } from 'typia'
import type { HicstatRequest, HicstatResponse } from '../src/routes/hicstat.ts'

export { hicstatPayload } from '../src/routes/hicstat.ts'

export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
