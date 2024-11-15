import { createValidate } from 'typia'
import type { GdcMafBuildRequest, GdcMafBuildResponse } from '../routes/gdc.mafBuild.ts'

export { GdcMafPayload } from '../routes/gdc.mafBuild.ts'

export const validGdcMafBuildRequest = createValidate<GdcMafBuildRequest>()
export const validGdcMafBuildResponse = createValidate<GdcMafBuildResponse>()
