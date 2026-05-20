import type { RouteApi } from '#types'
import { termdbTopTermsByTypePayload } from '#types/checkers'
import { init } from '../../routes/termdb.topTermsByType.ts'

export const api: RouteApi = {
	endpoint: 'termdb/getTopTermsByType',
	methods: {
		get: {
			...termdbTopTermsByTypePayload,
			init
		},
		post: {
			...termdbTopTermsByTypePayload,
			init
		}
	}
}
