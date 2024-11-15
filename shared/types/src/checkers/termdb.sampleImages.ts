import { createValidate } from 'typia'
import type { TermdbSampleImagesRequest, TermdbSampleImagesResponse } from '../routes/termdb.sampleImages.ts'

export { termdbSampleImagesPayload } from '../routes/termdb.sampleImages.ts'

export const validTermdbSampleImagesRequest = createValidate<TermdbSampleImagesRequest>()
export const validTermdbSampleImagesResponse = createValidate<TermdbSampleImagesResponse>()
