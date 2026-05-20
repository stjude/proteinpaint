import type { RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { init } from '../../routes/termdb.chat2.ts'

export const api: RouteApi = {
	endpoint: 'termdb/chat2',
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
