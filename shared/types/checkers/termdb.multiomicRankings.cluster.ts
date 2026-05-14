// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	MultiomicRankingsClusterRequest,
	MultiomicRankingsClusterResponse
} from '../src/routes/termdb.multiomicRankings.cluster.ts'

export { multiomicRankingsClusterPayload } from '../src/routes/termdb.multiomicRankings.cluster.ts'

export const validMultiomicRankingsClusterRequest = createValidate<MultiomicRankingsClusterRequest>()
export const validMultiomicRankingsClusterResponse = createValidate<MultiomicRankingsClusterResponse>()
