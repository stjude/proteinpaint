// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GdcGRIN2Request, GdcGRIN2Response } from '../src/routes/gdc.grin2.ts'
import type { RunGRIN2Request, RunGRIN2Response } from '../src/routes/gdc.grin2.ts'

export { gdcGRIN2Payload } from '../src/routes/gdc.grin2.ts'
export { runGRIN2Payload } from '../src/routes/gdc.grin2.ts'

export const validGdcGRIN2Request = createValidate<GdcGRIN2Request>()
export const validGdcGRIN2Response = createValidate<GdcGRIN2Response>()
export const validRunGRIN2Request = createValidate<RunGRIN2Request>()
export const validRunGRIN2Response = createValidate<RunGRIN2Response>()
