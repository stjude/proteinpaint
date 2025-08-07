// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ProfileScoresRequest, ProfileScoresResponse } from '../src/routes/termdb.profileScores.ts'

export { ProfileScoresPayload } from '../src/routes/termdb.profileScores.ts'

export const validProfileScoresRequest = createValidate<ProfileScoresRequest>()
export const validProfileScoresResponse = createValidate<ProfileScoresResponse>()
