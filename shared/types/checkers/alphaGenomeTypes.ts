// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { alphaGenomeTypesRequest, alphaGenomeTypesResponse } from '../src/routes/alphaGenomeTypes.ts'

export { alphaGenomeTypesPayload } from '../src/routes/alphaGenomeTypes.ts'

export const validalphaGenomeTypesRequest = createValidate<alphaGenomeTypesRequest>()
export const validalphaGenomeTypesResponse = createValidate<alphaGenomeTypesResponse>()
