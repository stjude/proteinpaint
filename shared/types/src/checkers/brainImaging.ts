import { createValidate } from 'typia'
import type { BrainImagingRequest, BrainImagingResponse } from '../routes/brainImaging.ts'

export { brainImagingPayload } from '../routes/brainImaging.ts'

export const validBrainImagingRequest = createValidate<BrainImagingRequest>()
export const validBrainImagingResponse = createValidate<BrainImagingResponse>()
