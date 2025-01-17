import { createValidate } from 'typia'
import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse } from '../src/routes/correlationVolcano.ts'

export { CorrelationVolcanoPayload } from '../src/routes/correlationVolcano.ts'

export const validCorrelationVolcanoRequest = createValidate<CorrelationVolcanoRequest>()
export const validCorrelationVolcanoResponse = createValidate<CorrelationVolcanoResponse>()
