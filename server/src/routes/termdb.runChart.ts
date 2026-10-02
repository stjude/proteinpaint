import type { RouteApi, RoutePayload } from '#types'
import { init } from '../../routes/termdb.runChart.ts'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.isSupportedChartOverride.runChart2
	get init() {
		return hasRunChartDs(genomes) ? init : null
	},
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

/* runChart2 is not in defaultCommonCharts of termdb.server.init.ts; a ds opts in via
ds.isSupportedChartOverride.runChart2 */
export function hasRunChartDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => {
			const runChart2 = ds.isSupportedChartOverride?.runChart2 ?? ds.commonCharts?.runChart2
			return !!runChart2
		})
	)
}
