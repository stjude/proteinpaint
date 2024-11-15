import { createValidate } from 'typia'
import type { GeneLookupRequest, GeneLookupResponse } from '../routes/genelookup.ts'

export { geneLookupPayload } from '../routes/genelookup.ts'

export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
