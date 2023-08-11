import { createValidate } from 'typia'
import { GeneLookupRequest, GeneLookupResponse } from '../../..genelookup.ts'
import { HealthCheckResponse } from '../../..healthcheck.ts'

export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
