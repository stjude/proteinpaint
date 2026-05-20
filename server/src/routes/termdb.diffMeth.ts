import type { RouteApi } from '#types'
import { diffMethPayload } from '#types/checkers'
import { init } from '../../routes/termdb.diffMeth.ts'

export const api: RouteApi = {
	endpoint: 'termdb/diffMeth',
	methods: {
		get: {
			...diffMethPayload,
			init
		},
		post: {
			...diffMethPayload,
			init
		}
	}
}
