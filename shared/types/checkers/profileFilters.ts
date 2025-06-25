// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ProfileFiltersRequest, ProfileFiltersResponse } from '../src/routes/profileFilters.ts'

export { ProfileFiltersPayload } from '../src/routes/profileFilters.ts'

export const validProfileFiltersRequest = createValidate<ProfileFiltersRequest>()
export const validProfileFiltersResponse = createValidate<ProfileFiltersResponse>()
