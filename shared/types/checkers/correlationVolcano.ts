// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse } from '../src/routes/correlationVolcano.ts'

export { CorrelationVolcanoPayload } from '../src/routes/correlationVolcano.ts'

export const validCorrelationVolcanoRequest = createValidate<CorrelationVolcanoRequest>()
export const validCorrelationVolcanoResponse = createValidate<CorrelationVolcanoResponse>()
