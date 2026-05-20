import type { RouteApi } from '#types'
import { termdbCategoriesPayload } from '#types/checkers'
import { init } from '../../routes/termdb.categories.ts'

export const api: RouteApi = {
	endpoint: 'termdb/categories',
	methods: {
		get: {
			...termdbCategoriesPayload,
			init
		},
		post: {
			...termdbCategoriesPayload,
			init
		}
	}
}
