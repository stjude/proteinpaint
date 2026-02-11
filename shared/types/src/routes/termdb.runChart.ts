import type { RoutePayload } from './routeApi.ts'

export type RunChartRequest = {
	genome: string
	dslabel: string
	/**
	 * term wrapper for x axis: { term, q }.
	 * runChart2: q.mode='continuous' → 1 series.
	 * runChart2Period: q.mode='discrete' (with bins) → multiple series by period.
	 */
	xtw: { term: { id: string }; q?: { mode?: 'continuous' | 'discrete' }; $id?: string }
	/** term wrapper for y axis: { term, q } */
	ytw: { term: { id: string }; q?: { mode?: string }; $id?: string }
	aggregation: 'median' | 'count'
	filter?: any
	__protected__?: any // auth token for accessing protected data
}

export type RunChartResponse = {
	status: 'ok' | 'error'
	/** each series is one curve, with a median. a runchart may show 1 or multiple curves */
	series: {
		/** period/series identifier */
		seriesId?: string
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
