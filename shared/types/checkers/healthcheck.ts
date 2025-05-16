// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { HealthCheckRequest, HealthCheckResponse } from '../src/routes/healthcheck.ts'

export { healthcheckPayload } from '../src/routes/healthcheck.ts'

export const validHealthCheckRequest = createValidate<HealthCheckRequest>()
export const validHealthCheckResponse = createValidate<HealthCheckResponse>()
