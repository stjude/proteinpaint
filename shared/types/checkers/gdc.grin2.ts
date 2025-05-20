// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GdcGRIN2listRequest, GdcGRIN2listResponse } from '../src/routes/gdc.grin2.ts'
import type { RunGRIN2Request, RunGRIN2Response } from '../src/routes/gdc.grin2.ts'

export { gdcGRIN2listPayload } from '../src/routes/gdc.grin2.ts'
export { runGRIN2Payload } from '../src/routes/gdc.grin2.ts'

export const validGdcGRIN2listRequest = createValidate<GdcGRIN2listRequest>()
export const validGdcGRIN2listResponse = createValidate<GdcGRIN2listResponse>()
export const validRunGRIN2Request = createValidate<RunGRIN2Request>()
export const validRunGRIN2Response = createValidate<RunGRIN2Response>()
