import { createValidate } from 'typia'
import type { GdcMafRequest, GdcMafResponse } from '../src/routes/gdc.maf.ts'

export { gdcMafPayload } from '../src/routes/gdc.maf.ts'

export const validGdcMafRequest = createValidate<GdcMafRequest>()
export const validGdcMafResponse = createValidate<GdcMafResponse>()
