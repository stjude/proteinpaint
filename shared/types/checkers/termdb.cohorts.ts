// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { TermdbCohortsRequest, TermdbCohortsResponse } from '../src/routes/termdb.cohorts.ts'

export { termdbCohortsPayload } from '../src/routes/termdb.cohorts.ts'

export const validTermdbCohortsRequest = createValidate<TermdbCohortsRequest>()
export const validTermdbCohortsResponse = createValidate<TermdbCohortsResponse>()
