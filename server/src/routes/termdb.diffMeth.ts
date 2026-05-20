import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.diffMeth.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DiffMethRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DiffMethResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/diffMeth',
	methods: {
		get: payload,
		post: payload
	}
}
