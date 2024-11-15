import { createValidate } from 'typia'
import type { GdcMafRequest, GdcMafResponse } from '../routes/gdc.maf.ts'

export { gdcMafPayload } from '../routes/gdc.maf.ts'

export const validGdcMafRequest = createValidate<GdcMafRequest>()
export const validGdcMafResponse = createValidate<GdcMafResponse>()
