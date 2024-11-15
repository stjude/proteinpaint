import { createValidate } from 'typia'
import type { SampleWSImagesRequest, SampleWSImagesResponse } from '../src/routes/samplewsimages.ts'

export { sampleWSImagesPayload } from '../src/routes/samplewsimages.ts'

export const validSampleWSImagesRequest = createValidate<SampleWSImagesRequest>()
export const validSampleWSImagesResponse = createValidate<SampleWSImagesResponse>()
