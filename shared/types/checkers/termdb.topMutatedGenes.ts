import { createValidate } from 'typia'
import type { topMutatedGeneRequest, topMutatedGeneResponse } from '../src/routes/termdb.topMutatedGenes.ts'

export { topMutatedGenePayload } from '../src/routes/termdb.topMutatedGenes.ts'

export const validTopMutatedGeneRequest = createValidate<topMutatedGeneRequest>()
export const validTopMutatedGeneResponse = createValidate<topMutatedGeneResponse>()
