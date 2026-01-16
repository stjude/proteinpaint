import type { RoutePayload } from './routeApi.ts'

export type RunChartRequest = {
	genome: string
	dslabel: string
	/** date term for x axis */
	term: {
		id: string
	}
	/** timeline/duration term for y axis */
	term2: {
		id: string
	}
	filter?: any
	__protected__?: any // auth token for accessing protected data
}

export type RunChartResponse = {
	status: 'ok' | 'error'
	/** each series is one curve, with a median. a runchart may show 1 or multiple curves */
	series: {
		/** calculated Y median value for this curve */
		median: number
		points: Point[]
	}[]
}

type Point = {
	/** decimal year, e.g. 2024.21321321 */
	x: number
	/** text of human-readable x value, e.g. "Jan 2024" which may be by the months, depends on dataset customization */
	xName: string
	/** timeline, e.g. number of days */
	y: number
	/** number of samples with this timeline at this time point */
	sampleCount: number
}

export const runChartPayload: RoutePayload = {
	request: {
		typeId: 'RunChartRequest'
	},
	response: {
		typeId: 'RunChartResponse'
	}
}
