import { createValidate } from 'typia'
import type { HealthCheckRequest, HealthCheckResponse } from '../src/routes/healthcheck.ts'
export { healthcheckPayload } from '../src/routes/healthcheck.ts'

export const validHealthCheckRequest = createValidate<HealthCheckRequest>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
