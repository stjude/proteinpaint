import type { RoutePayload } from './routeApi.js'

export type BoxPlotRequest = {
	//TOOD: define request
	tw: any
	genome: string
	dslabel: string
	divideTw?: any
	filter: any
	filter0: any
}

export type BoxPlotResponse = {
	/** Absolute min value for all plots */
	absMin?: number
	/** Absolute max value for all plots */
	absMax?: number
	/** Longest label length for all plots */
	maxLabelLgth: number
	plots: BoxPlotEntry[]
}

type BoxPlotEntry = {
	boxplot: BoxPlotData
	descrStats: BoxPlotDescrStatsEntry[]
	/** Label to show */
	label: string
	/** TODO: Is this needed? */
	// 	values: number[]
}

export type BoxPlotData = {
	/** Min/1st whisker value */
	w1: number | undefined
	/** Max/2nd whisker value */
	w2: number | undefined
	/** 5% */
	p05: number
	/** 25% */
	p25: number
	/** 50%, median */
	p50: number
	/** 75% */
	p75: number
	/** 95% */
	p95: number
	/** Interquartile region */
	iqr: number
	/** Outliers */
	out: { value: number }[]
}

export type BoxPlotDescrStatsEntry = {
	/** Use lower case for sanity check */
	id: 'total' | 'min' | 'p25' | 'median' | 'mean' | 'p75' | 'max' | 'sd' | 'variance' | 'iqr'
	label: string
	value: number
}

export const boxplotPayload: RoutePayload = {
	request: {
		typeId: 'BoxPlotRequest'
	},
	response: {
		typeId: 'BoxPlotResponse'
	}
	//examples: []
}
