import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { init } from '../../routes/profile.radar2.ts'

export const api: RouteApi = {
	endpoint: 'termdb/profileRadar2Scores',
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
