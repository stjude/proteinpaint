import { createIs, createValidate } from 'typia'
import { HealthCheckResponse } from '../../types/healthcheck'
import { GeneLookupRequest, GeneLookupResponse } from '../../../src/routes/genelookup'

export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
