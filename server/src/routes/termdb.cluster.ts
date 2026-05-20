import type { RouteApi } from '#types'
import { termdbClusterPayload } from '#types/checkers'
import { init } from '../../routes/termdb.cluster.ts'

export const api: RouteApi = {
	endpoint: 'termdb/cluster',
	methods: {
		get: {
			...termdbClusterPayload,
			init
		},
		post: {
			...termdbClusterPayload,
			init
		}
	}
}
