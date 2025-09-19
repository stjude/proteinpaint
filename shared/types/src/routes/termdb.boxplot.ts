import type { RoutePayload } from './routeApi.js'
import type { TermWrapper } from '../terms/tw.ts'
import type { Filter } from '../filter.ts'
import type { DescrStats } from './termdb.descrstats.ts'

/**Args set in Termdb vocab and from mass box plot */
export type BoxPlotRequest = {
	/** Args set in TermVocab */
	/** term1 or term */
	tw: TermWrapper
	genome: string
	dslabel: string
	/** if true, only return positive values */
	isLogScale: boolean
	/** sort plots by median value */
	orderByMedian: boolean
	/** term2 */
	overlayTw?: TermWrapper
	/** term0 */
	divideTw?: TermWrapper
	filter?: Filter
	filter0?: any
	__protected__: any
	removeOutliers?: boolean
}

export type BoxPlotResponse = {
	/** Absolute min value for all plots */
	absMin?: number
	/** Absolute max value for all plots */
	absMax?: number
	/** Charts data */
	charts: {
		[chartId: string]: BoxPlotChartEntry
	}
	/** Categories not shown in the final plot */
	uncomputableValues: { label: string; value: number }[] | null
	error?: any
	descrStats: DescrStats
}

// chart containing a set of boxplots
export type BoxPlotChartEntry = {
	/** Chart ID */
	chartId: string
	/** Boxplot data within the chart */
	plots: BoxPlotEntry[]
	/** svg of chart, necessary for svg download */
	svg?: any
	/** Copied from BoxPlotResponse, necessary for
	ViewModel to process chart data */
	absMin?: number
	absMax?: number
	uncomputableValues?: { label: string; value: number }[] | null
}

// individual boxplot
export type BoxPlotEntry = {
	boxplot: BoxPlotData & { label: string }
	/** color matching the value/category color */
	color?: string
	descrStats: DescrStats
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
	/** Short hand for summary stat. Use lower case for sanity check */
	id: 'total' | 'min' | 'p25' | 'median' | 'mean' | 'p75' | 'max' | 'sd' | 'variance' | 'iqr' | string
	/** Full label displayed to the user */
	label: string
	/** Calculated value. */
	value: number
}

export const boxplotPayload: RoutePayload = {
	request: {
		typeId: 'BoxPlotRequest'
	},
	response: {
		typeId: 'BoxPlotResponse'
	},
	examples: [
		{
			request: {
				body: {
					tw: {
						term: { id: 'subcohort', type: 'categorical' },
						values: [{ key: 'ABC', label: 'ABC' }]
					},
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					orderByMedian: true
				}
			},
			response: {
				body: {
					absMin: 0,
					absMax: 100,
					plots: [
						{
							boxplot: {
								label: 'ABC',
								w1: 0,
								w2: 100,
								p05: 0,
								p25: 25,
								p50: 50,
								p75: 75,
								p95: 100,
								iqr: 50,
								out: [101, 102, 106]
							},
							color: 'blue',
							descrStats: [
								{ id: 'total', label: 'Total', value: 100 },
								{ id: 'min', label: 'Min', value: 0 },
								{ id: 'p25', label: '25%', value: 25 },
								{ id: 'median', label: 'Median', value: 50 },
								{ id: 'mean', label: 'Mean', value: 50 },
								{ id: 'p75', label: '75%', value: 75 },
								{ id: 'max', label: 'Max', value: 100 },
								{ id: 'sd', label: 'SD', value: 0 },
								{ id: 'variance', label: 'Variance', value: 0 },
								{ id: 'iqr', label: 'IQR', value: 50 }
							],
							key: 'ABC'
						}
					],
					uncomputableValues: [{ label: 'uncomputable-test', value: 1 }]
				}
			}
		}
	]
}
