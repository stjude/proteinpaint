// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ViolinRequest, ViolinResponse } from '../src/routes/termdb.violin.ts'

export { violinPayload } from '../src/routes/termdb.violin.ts'

export const validViolinRequest = createValidate<ViolinRequest>()
export const validViolinResponse = createValidate<ViolinResponse>()
