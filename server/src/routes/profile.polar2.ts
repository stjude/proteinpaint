import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { init } from '../../routes/profile.polar2.ts'

export const api: RouteApi = {
	endpoint: 'termdb/profilePolar2Scores',
	methods: {
		get: {
			...ProfileScoresPayload,
			init
		},
		post: {
			...ProfileScoresPayload,
			init
		}
	}
}
