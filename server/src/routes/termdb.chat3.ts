import type { RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { init } from '../../routes/termdb.chat3.ts'

export const api: RouteApi = {
	endpoint: 'termdb/chat3',
	methods: {
		get: {
			...ChatPayload,
			init
		},
		post: {
			...ChatPayload,
			init
		}
	}
}
