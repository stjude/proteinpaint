import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/burden.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'BurdenRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BurdenResponse' }
}

export const api: RouteApi = {
	endpoint: 'burden',
	methods: {
		get: payload,
		post: payload
	}
}
