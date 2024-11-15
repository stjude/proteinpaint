import { createValidate } from 'typia'
import type { TermdbCohortsRequest, TermdbCohortsResponse } from '../routes/termdb.cohorts.ts'

export { termdbCohortsPayload } from '../routes/termdb.cohorts.ts'

export const validTermdbCohortsRequest = createValidate<TermdbCohortsRequest>()
export const validTermdbCohortsResponse = createValidate<TermdbCohortsResponse>()
