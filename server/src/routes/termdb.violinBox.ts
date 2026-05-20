import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.violinBox.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'ViolinBoxRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'ViolinBoxResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/violinBox',
	methods: {
		get: payload,
		post: payload
	}
}
