// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { MultiomicRankingsRequest, MultiomicRankingsResponse } from '../src/routes/termdb.multiomicRankings.ts'

export { multiomicRankingsPayload } from '../src/routes/termdb.multiomicRankings.ts'

export const validMultiomicRankingsRequest = createValidate<MultiomicRankingsRequest>()
export const validMultiomicRankingsResponse = createValidate<MultiomicRankingsResponse>()
