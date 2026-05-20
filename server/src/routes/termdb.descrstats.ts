import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.descrstats.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DescrStatsRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DescrStatsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/descrstats',
	methods: {
		get: payload,
		post: payload
	}
}
