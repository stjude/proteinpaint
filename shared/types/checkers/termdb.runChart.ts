// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { RunChartRequest, RunChartResponse } from '../src/routes/termdb.runChart.ts'

export { runChartPayload } from '../src/routes/termdb.runChart.ts'

export const validRunChartRequest = createValidate<RunChartRequest>()
export const validRunChartResponse = createValidate<RunChartResponse>()
