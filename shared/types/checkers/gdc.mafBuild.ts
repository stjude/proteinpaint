import { createValidate } from 'typia'
import type { GdcMafBuildRequest, GdcMafBuildResponse } from '../src/routes/gdc.mafBuild.ts'

export { GdcMafPayload } from '../src/routes/gdc.mafBuild.ts'

export const validGdcMafBuildRequest = createValidate<GdcMafBuildRequest>()
export const validGdcMafBuildResponse = createValidate<GdcMafBuildResponse>()
