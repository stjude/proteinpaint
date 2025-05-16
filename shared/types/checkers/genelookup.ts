// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GeneLookupRequest, GeneLookupResponse } from '../src/routes/genelookup.ts'

export { geneLookupPayload } from '../src/routes/genelookup.ts'

export const validGeneLookupRequest = createValidate<GeneLookupRequest>()
export const validGeneLookupResponse = createValidate<GeneLookupResponse>()
