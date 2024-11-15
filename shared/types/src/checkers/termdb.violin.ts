import { createValidate } from 'typia'
import type { ViolinRequest, ViolinResponse } from '../routes/termdb.violin.ts'

export { violinPayload } from '../routes/termdb.violin.ts'

export const validViolinRequest = createValidate<ViolinRequest>()
export const validViolinResponse = createValidate<ViolinResponse>()
