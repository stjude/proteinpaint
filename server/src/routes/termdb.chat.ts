import type { RouteApi } from '#types'
import { ChatPayload } from '#types/checkers'
import { init } from '../../routes/termdb.chat.ts'

export const api: RouteApi = {
	endpoint: 'termdb/chat',
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
