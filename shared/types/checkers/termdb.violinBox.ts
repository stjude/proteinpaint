// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ViolinBoxRequest, ViolinBoxResponse } from '../src/routes/termdb.violinBox.ts'

export { violinBoxPayload } from '../src/routes/termdb.violinBox.ts'

export const validViolinBoxRequest = createValidate<ViolinBoxRequest>()
export const validViolinBoxResponse = createValidate<ViolinBoxResponse>()
