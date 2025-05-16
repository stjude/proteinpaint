// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ClearWSImagesSessionsRequest, ClearWSImagesSessionsResponse } from '../src/routes/clearwsisessions.ts'

export { clearWSImagesSessionsPayload } from '../src/routes/clearwsisessions.ts'

export const validClearWSImagesSessionsRequest = createValidate<ClearWSImagesSessionsRequest>()
export const validClearWSImagesSessionsResponse = createValidate<ClearWSImagesSessionsResponse>()
