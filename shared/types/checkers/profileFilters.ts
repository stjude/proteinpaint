// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { profileFiltersRequest, profileFiltersResponse } from '../src/routes/profileFilters.ts'

export { ProfileFiltersPayload } from '../src/routes/profileFilters.ts'

export const validprofileFiltersRequest = createValidate<profileFiltersRequest>()
export const validprofileFiltersResponse = createValidate<profileFiltersResponse>()
