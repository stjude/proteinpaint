import type { RoutePayload, Point } from './routeApi.ts'

export type RunChartRequest = {
	genome: string
	dslabel: string
	term: string
	term2: string
	//Other parameters can be added here
}

export type RunChartResponse = {
	status: 'ok' | 'error'
	series: Point[]
}

export const runChartPayload: RoutePayload = {
	request: {
		typeId: 'RunChartRequest'
	},
	response: {
		typeId: 'RunChartResponse'
	}
}
