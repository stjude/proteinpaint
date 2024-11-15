import { createValidate } from 'typia'
import type { WSImagesRequest, WSImagesResponse } from '../routes/wsimages.ts'

export { wsImagesPayload } from '../routes/wsimages.ts'

export const validWSImagesRequest = createValidate<WSImagesRequest>()
export const validWSImagesResponse = createValidate<WSImagesResponse>()
