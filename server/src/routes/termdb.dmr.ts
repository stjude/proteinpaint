import type { RouteApi } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { init } from '../../routes/termdb.dmr.ts'

export const api: RouteApi = {
	endpoint: 'termdb/dmr',
	methods: {
		get: {
			...TermdbDmrPayload,
			init
		},
		post: {
			...TermdbDmrPayload,
			init
		}
	}
}
