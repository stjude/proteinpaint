import type { RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { init } from '../../routes/termdb.DE.ts'

export const api: RouteApi = {
	endpoint: 'termdb/DE',
	methods: {
		get: {
			...diffExpPayload,
			init
		},
		post: {
			...diffExpPayload,
			init
		}
	}
}
