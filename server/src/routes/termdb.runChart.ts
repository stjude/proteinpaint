import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/termdb.runChart.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'RunChartRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'RunChartResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/runChart',
	methods: {
		get: payload,
		post: payload
	}
}
