import { createValidate } from 'typia'
import type { BrainImagingRequest, BrainImagingResponse } from '../src/routes/brainImaging.ts'

export { brainImagingPayload } from '../src/routes/brainImaging.ts'

export const validBrainImagingRequest = createValidate<BrainImagingRequest>()
export const validBrainImagingResponse = createValidate<BrainImagingResponse>()
