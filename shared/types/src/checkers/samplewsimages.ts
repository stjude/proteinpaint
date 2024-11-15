import { createValidate } from 'typia'
import type { SampleWSImagesRequest, SampleWSImagesResponse } from '../routes/samplewsimages.ts'

export { sampleWSImagesPayload } from '../routes/samplewsimages.ts'

export const validSampleWSImagesRequest = createValidate<SampleWSImagesRequest>()
export const validSampleWSImagesResponse = createValidate<SampleWSImagesResponse>()
