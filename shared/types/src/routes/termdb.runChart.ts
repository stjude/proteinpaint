import type { RoutePayload } from './routeApi.ts'

export type RunChartRequest = {
	genome: string
	dslabel: string
	//Other parameters can be added here
}

export type RunChartResponse = {
	status: 'ok' | 'error'
}

export const runChartPayload: RoutePayload = {
	request: {
		typeId: 'RunChartRequest'
	},
	response: {
		typeId: 'RunChartResponse'
	}
}
