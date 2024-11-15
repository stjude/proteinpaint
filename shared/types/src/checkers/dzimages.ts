import { createValidate } from 'typia'
import type { DZImagesRequest, DZImagesResponse } from '../routes/dzimages.ts'

export { dzImagesPayload } from '../routes/dzimages.ts'

export const validDZImagesRequest = createValidate<DZImagesRequest>()
export const validDZImagesResponse = createValidate<DZImagesResponse>()
