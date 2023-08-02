import { createIs, createValidate } from 'typia'
import { HealthCheckResponse } from '../../src/health'

export const isHealthCheckResponse = createIs<HealthCheckResponse>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
