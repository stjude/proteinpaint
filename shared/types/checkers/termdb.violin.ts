import { createValidate } from 'typia'
import type { ViolinRequest, ViolinResponse } from '../src/routes/termdb.violin.ts'

export { violinPayload } from '../src/routes/termdb.violin.ts'

export const validViolinRequest = createValidate<ViolinRequest>()
export const validViolinResponse = createValidate<ViolinResponse>()
