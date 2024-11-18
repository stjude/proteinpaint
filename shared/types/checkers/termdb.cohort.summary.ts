import { createValidate } from 'typia'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../src/routes/termdb.cohort.summary.ts'

export { termdbCohortSummaryPayload } from '../src/routes/termdb.cohort.summary.ts'

export const validTermdbCohortSummaryRequest = createValidate<TermdbCohortSummaryRequest>()
export const validTermdbCohortSummaryResponse = createValidate<TermdbCohortSummaryResponse>()
