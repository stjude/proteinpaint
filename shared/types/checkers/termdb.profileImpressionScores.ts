// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	ProfileImpressionScoresRequest,
	ProfileImpressionScoresResponse
} from '../src/routes/termdb.profileImpressionScores.ts'

export { ProfileImpressionScoresPayload } from '../src/routes/termdb.profileImpressionScores.ts'

export const validProfileImpressionScoresRequest = createValidate<ProfileImpressionScoresRequest>()
export const validProfileImpressionScoresResponse = createValidate<ProfileImpressionScoresResponse>()
