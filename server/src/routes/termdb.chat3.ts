import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.chat3.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'ChatRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ChatResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/chat3',
	methods: {
		get: payload,
		post: payload
	}
}
