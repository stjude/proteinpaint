import type { RouteApi } from '#types'
import { ProfileFormScoresPayload } from '#types/checkers'
import { init } from '../../routes/termdb.profileFormScores.ts'

export const api: RouteApi = {
	endpoint: 'termdb/profileFormScores',
	methods: {
		get: {
			...ProfileFormScoresPayload,
			init
		},
		post: {
			...ProfileFormScoresPayload,
			init
		}
	}
}
