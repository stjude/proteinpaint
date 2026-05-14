// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GeneRankingRequest, GeneRankingResponse } from '../src/routes/termdb.geneRanking.ts'

export { geneRankingPayload } from '../src/routes/termdb.geneRanking.ts'

export const validGeneRankingRequest = createValidate<GeneRankingRequest>()
export const validGeneRankingResponse = createValidate<GeneRankingResponse>()
