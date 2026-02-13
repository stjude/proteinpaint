// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { FrequencyChartRequest, FrequencyChartResponse } from '../src/routes/termdb.frequencyChart'
export { frequencyChartPayload } from '../src/routes/termdb.frequencyChart'

export const validFrequencyChartRequest = createValidate<FrequencyChartRequest>()
export const validFrequencyChartResponse = createValidate<FrequencyChartResponse>()
