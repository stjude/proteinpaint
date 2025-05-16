// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { DZImagesRequest, DZImagesResponse } from '../src/routes/dzimages.ts'

export { dzImagesPayload } from '../src/routes/dzimages.ts'

export const validDZImagesRequest = createValidate<DZImagesRequest>()
export const validDZImagesResponse = createValidate<DZImagesResponse>()
