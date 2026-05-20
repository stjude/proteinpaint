import type { RouteApi } from '#types'
import { descrStatsPayload } from '#types/checkers'
import { init } from '../../routes/termdb.descrstats.ts'

export const api: RouteApi = {
	endpoint: 'termdb/descrstats',
	methods: {
		get: {
			...descrStatsPayload,
			init
		},
		post: {
			...descrStatsPayload,
			init
		}
	}
}
