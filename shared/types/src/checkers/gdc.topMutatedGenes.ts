import { createValidate } from 'typia'
import type { GdcTopMutatedGeneRequest, GdcTopMutatedGeneResponse } from '../routes/gdc.topMutatedGenes.ts'

export { gdcTopMutatedGenePayload } from '../routes/gdc.topMutatedGenes.ts'

export const validGdcTopMutatedGeneRequest = createValidate<GdcTopMutatedGeneRequest>()
export const validGdcTopMutatedGeneResponse = createValidate<GdcTopMutatedGeneResponse>()
