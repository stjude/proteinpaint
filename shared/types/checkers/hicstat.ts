// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { HicstatRequest, HicstatResponse } from '../src/routes/hicstat.ts'

export { hicstatPayload } from '../src/routes/hicstat.ts'

export const validHicstatRequest = createValidate<HicstatRequest>()
export const validHicstatResponse = createValidate<HicstatResponse>()
