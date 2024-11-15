import { createValidate } from 'typia'
import type { BoxPlotRequest, BoxPlotResponse } from '../routes/termdb.boxplot.ts'

export { boxplotPayload } from '../routes/termdb.boxplot.ts'

export const validBoxPlotRequest = createValidate<BoxPlotRequest>()
export const validBoxPlotResponse = createValidate<BoxPlotResponse>()
