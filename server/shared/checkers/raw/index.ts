import { createIs, createValidate } from 'typia'
import { HealthCheckResponse } from '../../types/healthcheck'

export const isHealthCheckResponse = createIs<HealthCheckResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
