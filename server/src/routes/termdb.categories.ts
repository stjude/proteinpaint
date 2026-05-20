import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.categories.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'CategoriesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'CategoriesResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/categories',
	methods: {
		get: payload,
		post: payload
	}
}
