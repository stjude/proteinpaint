import { createValidate } from 'typia'
import { GeneLookupRequest, GeneLookupResponse } from '../../../routes/genelookup.ts'
import { HealthCheckResponse } from '../../../routes/healthcheck.ts'
import { getViolinDataRequest, getViolinDataResponse } from '../../../routes/termdb.violin.ts'

export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validgetViolinDataRequest = createValidate<getViolinDataRequest>()
export const validgetViolinDataResponse = createValidate<getViolinDataResponse>()
