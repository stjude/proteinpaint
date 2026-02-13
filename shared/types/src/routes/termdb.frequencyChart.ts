import type { RoutePayload } from './routeApi.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Filter } from '../filter.ts'

export type FrequencyChartRequest = {
	genome: string
	dslabel: string
	/** Array with single term wrapper for the date/time term */
	coordTWs: TermWrapper[]
	/** Chart type identifier */
	chartType: 'frequencyChart' | 'frequencyChart2'
	/** Optional filter */
	filter?: Filter
	/** Embedder identifier */
	embedder?: string
	__protected__?: any
}

export type FrequencyChartPoint = {
	/** Decimal year (e.g., 2024.5 for mid-2024) */
	x: number
	/** Human-readable date label (e.g., "2024-06") */
	xName: string
	/** Frequency count (cumulative or per-period) */
	y: number
	/** Number of samples in this time period */
	sampleCount: number
}

export type FrequencyChartResponse = {
	status: 'ok' | 'error'
	error?: string
	/** Array of frequency data points sorted chronologically */
	points: FrequencyChartPoint[]
}

export const frequencyChartPayload: RoutePayload = {
	request: {
		typeId: 'FrequencyChartRequest'
	},
	response: {
		typeId: 'FrequencyChartResponse'
	}
}
