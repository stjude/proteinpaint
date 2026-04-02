import type { RoutePayload } from './routeApi.js'
import type { TermWrapper } from '../terms/tw.ts'
import type { Filter } from '../filter.ts'
import type { ErrorResponse } from './errorResponse.ts'
import type { DescrStats } from './termdb.descrstats.ts'

/** Common properties shared by both violin and box plots */
type CommonProps = {
	/** numeric tw to fetch numeric data. tw.q.mode must be continuous */
	tw: TermWrapper
	dslabel: string
	genome: string
	/** overlay tw for multiple violins/boxplots */
	overlayTw?: TermWrapper
	/** tw to divide to multiple charts */
	divideTw?: TermWrapper
	/** mass filter */
	filter?: Filter
	/** read-only invisible filter */
	filter0?: any
	/** TODO: Needs description FIXME delete */
	currentGeneNames?: string[]
	/** if true, use log scale; if false or undefined, use linear scale */
	isLogScale?: boolean
}

/** Request type for violin plots with required violin-specific parameters */
export type ViolinRequest = CommonProps & {
	/** Indicates the type of chart to render */
	plotType: 'violin'
	/** A number representing the dimension perpendicular to the violin spread */
	axisHeight?: number
	/** A string representing the type of symbol used on the plot */
	datasymbol?: string
	/** A number representing the device's pixel ratio */
	devicePixelRatio: number
	/** If true, uses KDE method to build plot */
	isKDE?: boolean
	/** A string with two possible values: 'horizontal' or 'vertical' */
	orientation: string
	/** A number representing the radius of the data symbols */
	radius: number
	/** A number representing the right margin */
	rightMargin?: number
	/** Term may be scaled from regression analysis */
	scale?: any
	/** A number representing the width of the stroke */
	strokeWidth?: number
	/** A number representing the width of the SVG box */
	svgw: number
	/** Number of bins to build the plot. Default is 20. */
	ticks?: number
}

/** Request type for box plots with required box-specific parameters */
export type BoxRequest = CommonProps & {
	/** Indicates the type of chart to render */
	plotType: 'box'
	/** sort plots by median value */
	orderByMedian?: boolean
	/** Remove outliers from the plot */
	removeOutliers?: boolean
	/** If true, show association tests table */
	showAssocTests?: boolean
}

/**Unified request type for violin and boxplot - union of ViolinRequest and BoxRequest */
export type ViolinBoxRequest = ViolinRequest | BoxRequest

export type ViolinBoxResponse = ViolinResponse | BoxPlotResponse | ErrorResponse

/** Type guard to check if response is an ErrorResponse */
export function isErrorResponse(response: ViolinBoxResponse): response is ErrorResponse {
	return 'error' in response && 'status' in response
}

/** Type guard to check if response is a BoxPlotResponse */
export function isBoxPlotResponse(response: ViolinBoxResponse): response is BoxPlotResponse {
	return !isErrorResponse(response) && 'charts' in response && 'descrStats' in response
}

/** Type guard to check if response is a ViolinResponse */
export function isViolinResponse(response: ViolinBoxResponse): response is ViolinResponse {
	return !isErrorResponse(response) && 'min' in response && 'max' in response
}

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
					isLogScale: false
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
