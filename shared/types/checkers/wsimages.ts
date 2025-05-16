// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { WSImagesRequest, WSImagesResponse } from '../src/routes/wsimages.ts'

export { wsImagesPayload } from '../src/routes/wsimages.ts'

export const validWSImagesRequest = createValidate<WSImagesRequest>()
export const validWSImagesResponse = createValidate<WSImagesResponse>()
