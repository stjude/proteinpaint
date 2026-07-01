// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	ProfileImpressionDistributionRequest,
	ProfileImpressionDistributionResponse
} from '../src/routes/termdb.profileImpressionDistribution.ts'

export { ProfileImpressionDistributionPayload } from '../src/routes/termdb.profileImpressionDistribution.ts'

export const validProfileImpressionDistributionRequest = createValidate<ProfileImpressionDistributionRequest>()
export const validProfileImpressionDistributionResponse = createValidate<ProfileImpressionDistributionResponse>()
