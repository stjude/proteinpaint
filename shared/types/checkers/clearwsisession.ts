import { createValidate } from 'typia'
import type { ClearWSImagesSessionsRequest, ClearWSImagesSessionsResponse } from '../src/routes/clearwsisessions.ts'

export { clearWSImagesSessionsPayload } from '../src/routes/clearwsisessions.ts'

export const validClearWSImagesSessionsRequest = createValidate<ClearWSImagesSessionsRequest>()
export const validClearWSImagesSessionsResponse = createValidate<ClearWSImagesSessionsResponse>()
