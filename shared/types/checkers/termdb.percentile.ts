import { createValidate } from 'typia'
import type { PercentileRequest, PercentileResponse } from '../src/routes/termdb.percentile.ts'

export { percentilePayload } from '../src/routes/termdb.percentile.ts'

export const validPercentileRequest = createValidate<PercentileRequest>()
export const validPercentileResponse = createValidate<PercentileResponse>()
