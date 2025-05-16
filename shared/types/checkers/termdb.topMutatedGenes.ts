// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { topMutatedGeneRequest, topMutatedGeneResponse } from '../src/routes/termdb.topMutatedGenes.ts'

export { topMutatedGenePayload } from '../src/routes/termdb.topMutatedGenes.ts'

export const validtopMutatedGeneRequest = createValidate<topMutatedGeneRequest>()
export const validtopMutatedGeneResponse = createValidate<topMutatedGeneResponse>()
