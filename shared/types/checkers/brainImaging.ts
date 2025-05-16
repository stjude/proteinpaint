// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { BrainImagingRequest, BrainImagingResponse } from '../src/routes/brainImaging.ts'

export { brainImagingPayload } from '../src/routes/brainImaging.ts'

export const validBrainImagingRequest = createValidate<BrainImagingRequest>()
export const validBrainImagingResponse = createValidate<BrainImagingResponse>()
