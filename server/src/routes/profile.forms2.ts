import type { RouteApi } from '#types'
import { ProfileForms2ScoresPayload } from '#types/checkers'
import { init } from '../../routes/profile.forms2.ts'

export const api: RouteApi = {
	endpoint: 'termdb/profileForms2Scores',
	methods: {
		get: {
			...ProfileForms2ScoresPayload,
			init
		},
		post: {
			...ProfileForms2ScoresPayload,
			init
		}
	}
}
