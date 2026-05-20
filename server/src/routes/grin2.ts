import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/grin2.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'GRIN2Request' /*, checkers: TODO write validator */ },
	response: { typeId: 'GRIN2Response' }
}

export const api: RouteApi = {
	endpoint: 'grin2',
	methods: {
		get: payload,
		post: payload
	}
}
