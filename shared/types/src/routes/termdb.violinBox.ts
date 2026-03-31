import type { RoutePayload } from './routeApi.js'
import type { TermWrapper } from '../terms/tw.ts'
import type { Filter } from '../filter.ts'
import type { ErrorResponse } from './errorResponse.ts'
import type { DescrStats } from './termdb.descrstats.ts'

/**Unified request type for violin and boxplot */
export type ViolinBoxRequest = {
	/** Indicates the type of chart to render: 'violin' or 'box' */
	plotType: 'violin' | 'box'
	/** main tw to fetch numeric data */
	tw: TermWrapper
	/** Reference label (i.e. short label) for the ds */
	dslabel: string
	/** Reference label */
	genome: string
	/** optional overlay tw, will generate multiple plots */
	overlayTw?: TermWrapper
	/** optional divide tw, will generate multiple charts */
	divideTw?: TermWrapper
	/** optional mass filter */
	filter?: Filter
	/** optional read-only invisible filter */
	filter0?: any

	// Violin-specific properties
	/** A number representing the dimension perpendicular to the violin spread */
	axisHeight?: number
	/** ?? TODO: Needs description */
	currentGeneNames?: string[]
	/** A string representing the type of symbol used on the plot */
	datasymbol?: string
	/** A number representing the device's pixel ratio */
	devicePixelRatio?: number
	/** If true, uses KDE method to build plot */
	isKDE?: boolean
	/** A string with two possible values: 'horizontal' or 'vertical' */
	orientation?: 'horizontal' | 'vertical'
	/** A number representing the radius of the data symbols */
	radius?: number
	/** A number representing the right margin */
	rightMargin?: number
	/** Term may be scaled from regression analysis */
	scale?: any
	/** A number representing the width of the stroke */
	strokeWidth?: number
	/** A number representing the width of the SVG box */
	svgw?: number
	/** Number of bins to build the plot. Default is 20. */
	ticks?: number
	/** A string representing a unit of measurement (e.g., 'log' for log scale) */
	unit?: string

	// Boxplot-specific properties
	/** if true, only return positive values */
	isLogScale?: boolean
	/** sort plots by median value */
	orderByMedian?: boolean
	/** Remove outliers from the plot */
	removeOutliers?: boolean
	/** If true, show association tests table */
	showAssocTests?: boolean
}

export type ViolinBoxResponse = ViolinResponse | BoxPlotResponse | ErrorResponse

/** Violin response types */
interface BinsEntries {
	x0: number
	x1: number
	density: number
}

interface ValuesEntries {
	id: string
	label: string
	value: number
}

interface PValueEntries {
	value?: string
	html?: string
}

type ViolinDensity = {
	bins: BinsEntries[]
	densityMax: number
	densityMin: number
}

export type ViolinPlotEntry = {
	color: string
	chartId: string
	density: ViolinDensity
	label: string
	plotValueCount: number
	seriesId: string
	src: string
	summaryStats: ValuesEntries[]
}

type ViolinResponse = {
	bins: { [index: string]: any }
	charts: {
		[index: string]: {
			chartId: string
			plots: ViolinPlotEntry[]
			pvalues?: PValueEntries[][]
		}
	}
	min: number
	max: number
	uncomputableValues: { [index: string]: number }[] | null
	descrStats?: DescrStats
}

/** Boxplot response types */
export type BoxPlotData = {
	w1: number | undefined
	w2: number | undefined
	p05: number
	p25: number
	p50: number
	p75: number
	p95: number
	iqr: number
	out: { value: number }[]
}

export type BoxPlotEntry = {
	boxplot: BoxPlotData & { label: string }
	color?: string
	descrStats: DescrStats
	isHidden?: boolean
	key: string
	seriesId?: string
}

export type BoxPlotChartEntry = {
	chartId: string
	plots: BoxPlotEntry[]
	sampleCount: number
	wilcoxon?: [{ value: string }, { value: string }, { html: string }][]
}

type BoxPlotResponse = {
	absMin?: number
	absMax?: number
	bins?: {
		[index: string]: any
	}
	charts: {
		[chartId: string]: BoxPlotChartEntry
	}
	descrStats: DescrStats
	uncomputableValues: { label: string; value: number }[] | null
}

export const violinBoxPayload: RoutePayload = {
	request: {
		typeId: 'ViolinBoxRequest'
	},
	response: {
		typeId: 'ViolinBoxResponse'
	},
	examples: [
		{
			request: {
				body: {
					plotType: 'violin',
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					tw: {
						term: { id: 'aaclassic_5', type: 'float' },
						q: { mode: 'continuous' }
					},
					devicePixelRatio: 2,
					svgw: 200,
					orientation: 'horizontal',
					datasymbol: 'rug',
					radius: 5,
					unit: 'abs'
				}
			},
			response: {
				header: { status: 200 }
			}
		},
		{
			request: {
				body: {
					plotType: 'box',
					genome: 'hg38-test',
					dslabel: 'TermdbTest',
					tw: {
						term: { id: 'agedx', type: 'float' },
						q: { mode: 'continuous' }
					},
					overlayTw: {
						term: { id: 'sex', type: 'categorical' }
					},
					orderByMedian: true
				}
			},
			response: {
				header: { status: 200 }
			}
		}
	]
}
