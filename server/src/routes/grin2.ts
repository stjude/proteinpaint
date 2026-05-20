import type { RouteApi } from '#types'
import { GRIN2Payload } from '#types/checkers'
import { init } from '../../routes/grin2.ts'

export const api: RouteApi = {
	endpoint: 'grin2',
	methods: {
		get: {
			...GRIN2Payload,
			init
		},
		post: {
			...GRIN2Payload,
			init
		}
	}
}
