import { createValidate } from 'typia'
import type { DZImagesRequest, DZImagesResponse } from '../src/routes/dzimages.ts'

export { dzImagesPayload } from '../src/routes/dzimages.ts'

export const validDZImagesRequest = createValidate<DZImagesRequest>()
export const validDZImagesResponse = createValidate<DZImagesResponse>()
