// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { GeneRankingClusterRequest, GeneRankingClusterResponse } from '../src/routes/termdb.geneRanking.cluster.ts'

export { geneRankingClusterPayload } from '../src/routes/termdb.geneRanking.cluster.ts'

export const validGeneRankingClusterRequest = createValidate<GeneRankingClusterRequest>()
export const validGeneRankingClusterResponse = createValidate<GeneRankingClusterResponse>()
