// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { VolcanoPlotRequest, VolcanoPlotResponse } from '../src/routes/termdb.volcanoPlot.ts'

export { volcanoPlotPayload } from '../src/routes/termdb.volcanoPlot.ts'

export const validVolcanoPlotRequest = createValidate<VolcanoPlotRequest>()
export const validVolcanoPlotResponse = createValidate<VolcanoPlotResponse>()
