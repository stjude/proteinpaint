import type { RoutePayload } from './routeApi.js'

export type BoxPlotRequest = {
	/** Args set in TermVocab */
	/** term1 or term */
	tw: any
	genome: string
	dslabel: string
	/** term2 */
	overlayTw?: any
	filter: any
	filter0: any
}

export type BoxPlotResponse = {
	/** Absolute min value for all plots */
	absMin?: number
	/** Absolute max value for all plots */
	absMax?: number
	plots: BoxPlotEntry[]
	/** Categories not shown in the final plot */
	uncomputableValues: { label: string; value: number }[] | null
}

export type BoxPlotEntry = {
	boxplot: BoxPlotData & { label: string }
	/** color matching the value/category color */
	color?: string
	descrStats: BoxPlotDescrStatsEntry[]
	/** Pertains to an uncomputable term value and
	 * whether or not the plot is hidden by default */
	isHidden?: boolean
	key: string
	/** Formatted bins for numeric terms */
	overlayBins?: any
	/** Usually the same as key, but determined by the tw */
	seriesId?: string
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
	/** Use lower case for sanity check
	 * 'total' | 'min' | 'p25' | 'median' | 'mean' | 'p75' | 'max' | 'sd' | 'variance' | 'iqr'
	 */
	id: string
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
