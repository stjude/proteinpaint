import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.DE.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DERequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DEResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/DE',
	methods: {
		get: payload,
		post: payload
	}
}
