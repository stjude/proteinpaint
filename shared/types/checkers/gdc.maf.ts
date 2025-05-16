// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GdcMafRequest, GdcMafResponse } from '../src/routes/gdc.maf.ts'

export { gdcMafPayload } from '../src/routes/gdc.maf.ts'

export const validGdcMafRequest = createValidate<GdcMafRequest>()
export const validGdcMafResponse = createValidate<GdcMafResponse>()
