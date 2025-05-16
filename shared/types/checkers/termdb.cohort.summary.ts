// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbCohortSummaryRequest, TermdbCohortSummaryResponse } from '../src/routes/termdb.cohort.summary.ts'

export { termdbCohortSummaryPayload } from '../src/routes/termdb.cohort.summary.ts'

export const validTermdbCohortSummaryRequest = createValidate<TermdbCohortSummaryRequest>()
export const validTermdbCohortSummaryResponse = createValidate<TermdbCohortSummaryResponse>()
