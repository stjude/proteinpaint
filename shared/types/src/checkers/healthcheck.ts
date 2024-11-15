import { createValidate } from 'typia'
import type { HealthCheckRequest, HealthCheckResponse } from '../routes/healthcheck.ts'

export { healthcheckPayload } from '../routes/healthcheck.ts'

export const validHealthCheckRequest = createValidate<HealthCheckRequest>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
