import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/termdb.cluster.ts'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbClusterRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbClusterResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cluster',
	methods: {
		get: payload,
		post: payload
	}
}
