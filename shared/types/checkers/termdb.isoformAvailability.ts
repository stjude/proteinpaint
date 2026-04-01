// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	TermdbIsoformAvailabilityRequest,
	TermdbIsoformAvailabilityResponse
} from '../src/routes/termdb.isoformAvailability.ts'

export { TermdbIsoformAvailabilityPayload } from '../src/routes/termdb.isoformAvailability.ts'

export const validTermdbIsoformAvailabilityRequest = createValidate<TermdbIsoformAvailabilityRequest>()
export const validTermdbIsoformAvailabilityResponse = createValidate<TermdbIsoformAvailabilityResponse>()
