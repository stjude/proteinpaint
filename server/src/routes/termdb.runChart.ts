import type { RouteApi } from '#types'
import { runChartPayload } from '#types/checkers'
import { init } from '../../routes/termdb.runChart.ts'

export const api: RouteApi = {
	endpoint: 'termdb/runChart',
	methods: {
		get: {
			...runChartPayload,
			init
		},
		post: {
			...runChartPayload,
			init
		}
	}
}
