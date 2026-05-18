import type { SingleCellPlotDataResult } from '#types'
import type { ScaleLinear } from 'd3-scale'
import type { Div, Svg, SvgG } from '../../types/d3'

export type ColorLegendItem = {
	key: string
	color: string
	sampleCount: number
}

export type ShapeLegendItem = {
	key: string
	shape: number
	sampleCount: number
}

export type ScatterLegendItem = ColorLegendItem | ShapeLegendItem

export type ColorLegendEntry = [label: string, item: ColorLegendItem]
export type ShapeLegendEntry = [label: string, item: ShapeLegendItem]

export type ColorLegend = ColorLegendEntry[]
export type ShapeLegend = ShapeLegendEntry[]
export type ScatterLegendData = ColorLegend | ShapeLegend

export type ScatterColorMap = {
	[key: string]: ColorLegendItem
}
export type ScatterShapeMap = {
	[key: string]: ShapeLegendItem
}

export type DataRange = {
	xMin: number
	xMax: number
	yMin: number
	yMax: number
	/** Gene expression min. Used for coloring and the color scale */
	geMin?: number
	/** Gene expression max. Used for coloring and the color scale */
	geMax?: number
}

export type ScatterDataResult = {
	colorLegend: ColorLegendEntry[]
	shapeLegend: ShapeLegendEntry[]
	colorMap: ScatterColorMap
	shapeMap: ScatterShapeMap
	samples?: any[]
	/** Server generated image for a single cell plot */
	src?: string
	/** Total number of samples in a plot. */
	totalSampleCount?: number
}

export type ScatterRanges = DataRange & {
	zMin?: number
	zMax?: number
	scaleMin?: number
	scaleMax?: number
}

export type ScatterChart = {
	/** The root SVG element for the scatter plot */
	svg?: Svg
	/** The container div wrapping the chart */
	chartDiv?: Div
	/** The main SVG group element containing plot content */
	mainG?: SvgG
	/** SVG group for rendering regression lines/curves */
	regressionG?: SvgG
	/** SVG group for the x-axis */
	xAxis?: SvgG
	/** The d3 bottom axis generator instance */
	axisBottom?: any
	/** SVG group for the y-axis */
	yAxis?: SvgG
	/** The d3 left axis generator instance */
	axisLeft?: any
	/** The d3 selection of data point elements */
	serie?: any
	/** The lasso selection tool instance */
	lasso?: any
	/** The computed min/max ranges for axes and scales */
	ranges?: ScatterRanges
	/** Unique identifier for this chart instance */
	id: string
	/** Samples belonging to the current cohort */
	cohortSamples: any
	/** The d3 linear scale for mapping data to x-axis pixel positions */
	xAxisScale?: ScaleLinear<number, number>
	/** The d3 linear scale for mapping data to y-axis pixel positions */
	yAxisScale?: ScaleLinear<number, number>
	/** The rendered regression curve/line element */
	regressionCurve?: any
	/** The x-axis range */
	xRange?: number[]
	/** The y-axis range */
	yRange?: number[]
	/** The x-axis label */
	xLabel?: string
	/** The y-axis label */
	yLabel?: string
	/** The title of the chart */
	title?: string
	/** The data for the chart */
	data: ScatterDataResult | SingleCellPlotDataResult
	/** The color legend map for the chart */
	colorLegend: Map<string, ColorLegendItem>
	/** The shape legend map for the chart */
	shapeLegend: Map<string, ShapeLegendItem>
	axisG?: SvgG
	labelsG?: SvgG
	/** Server generated image for a single cell plot */
	src?: string
	/** Total number of samples in a plot. */
	totalSampleCount?: number
}

export type ValidScatterDataResponse = { range: DataRange; result: { [index: string]: ScatterDataResult } }

export type ScatterErrorResponse = { error: string }

export type ScatterResponse = ValidScatterDataResponse | ScatterErrorResponse
