// this file was auto-generated using 'npm run generate' or 'npm run dev' from the shared/types dir
import { createValidate } from 'typia'
import type {
	ProfileForms2ScoresRequest,
	ProfileForms2ScoresResponse
} from '../src/routes/termdb.profileForms2Scores.ts'

export { ProfileForms2ScoresPayload } from '../src/routes/termdb.profileForms2Scores.ts'

export const validProfileForms2ScoresRequest = createValidate<ProfileForms2ScoresRequest>()
export const validProfileForms2ScoresResponse = createValidate<ProfileForms2ScoresResponse>()
