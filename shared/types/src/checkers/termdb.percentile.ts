import { createValidate } from 'typia'
import type { PercentileRequest, PercentileResponse } from '../routes/termdb.percentile.ts'

export { percentilePayload } from '../routes/termdb.percentile.ts'

export const validPercentileRequest = createValidate<PercentileRequest>()
export const validPercentileResponse = createValidate<PercentileResponse>()
