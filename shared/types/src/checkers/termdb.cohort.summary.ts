import { createValidate } from 'typia'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../routes/termdb.cohort.summary.ts'

export { termdbCohortSummaryPayload } from '../routes/termdb.cohort.summary.ts'

export const validTermdbCohortSummaryRequest = createValidate<TermdbCohortSummaryRequest>()
export const validTermdbCohortSummaryResponse = createValidate<TermdbCohortSummaryResponse>()
