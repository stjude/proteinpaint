// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { PlotFiltersRequest, PlotFiltersResponse } from '../src/routes/plotFilters.ts'

export { PlotFiltersPayload } from '../src/routes/plotFilters.ts'

export const validPlotFiltersRequest = createValidate<PlotFiltersRequest>()
export const validPlotFiltersResponse = createValidate<PlotFiltersResponse>()
