import type { RouteApi } from '#types'
import { FilterTermValuesPayload } from '#types/checkers'
import { init } from '../../routes/termdb.filterTermValues.ts'

export const api: RouteApi = {
	endpoint: 'termdb/filterTermValues',
	methods: {
		get: {
			...FilterTermValuesPayload,

			init
		},
		post: {
			...FilterTermValuesPayload,
			init
		}
	}
}
