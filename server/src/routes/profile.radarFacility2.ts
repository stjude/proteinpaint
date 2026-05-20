import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { init } from '../../routes/profile.radarFacility2.ts'

export const api: RouteApi = {
	endpoint: 'termdb/profileRadarFacility2Scores',
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
