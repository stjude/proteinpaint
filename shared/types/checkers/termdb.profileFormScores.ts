// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type { ProfileFormScoresRequest, ProfileFormScoresResponse } from '../src/routes/termdb.profileFormScores.ts'

export { ProfileFormScoresPayload } from '../src/routes/termdb.profileFormScores.ts'

export const validProfileFormScoresRequest = createValidate<ProfileFormScoresRequest>()
export const validProfileFormScoresResponse = createValidate<ProfileFormScoresResponse>()
