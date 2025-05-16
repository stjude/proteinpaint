// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { SampleWSImagesRequest, SampleWSImagesResponse } from '../src/routes/samplewsimages.ts'

export { sampleWSImagesPayload } from '../src/routes/samplewsimages.ts'

export const validSampleWSImagesRequest = createValidate<SampleWSImagesRequest>()
export const validSampleWSImagesResponse = createValidate<SampleWSImagesResponse>()
