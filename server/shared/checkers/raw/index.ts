import { createValidate } from 'typia'
import { GeneLookupRequest, GeneLookupResponse } from '../../../routes/genelookup.ts'
import { HealthCheckResponse } from '../../../routes/healthcheck.ts'

export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
