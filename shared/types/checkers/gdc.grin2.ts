import { createValidate } from 'typia'
import type { GdcGRIN2Request, GdcGRIN2Response, RunGRIN2Request, RunGRIN2Response } from '../src/routes/gdc.grin2.ts'

export { gdcGRIN2Payload, runGRIN2Payload } from '../src/routes/gdc.grin2.ts'

// Create validators for the request and response types
export const validGdcGRIN2Request = createValidate<GdcGRIN2Request>()
export const validGdcGRIN2Response = createValidate<GdcGRIN2Response>()
export const validRunGRIN2Request = createValidate<RunGRIN2Request>()
export const validRunGRIN2Response = createValidate<RunGRIN2Response>()
