import type { RouteApi } from '#types'
import { burdenPayload } from '#types/checkers'
import { init } from '../../routes/burden.ts'

export const api: RouteApi = {
	endpoint: 'burden',
	methods: {
		get: {
			init,
			...burdenPayload
		},
		post: {
			init,
			...burdenPayload
		}
	}
}
