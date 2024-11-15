import { createValidate } from 'typia'
import type { BoxPlotRequest, BoxPlotResponse } from '../src/routes/termdb.boxplot.ts'

export { boxplotPayload } from '../src/routes/termdb.boxplot.ts'

export const validBoxPlotRequest = createValidate<BoxPlotRequest>()
export const validBoxPlotResponse = createValidate<BoxPlotResponse>()
