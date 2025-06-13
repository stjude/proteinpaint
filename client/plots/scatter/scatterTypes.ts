import type { AxisScale } from 'd3'

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

export type ScatterDataResponse = { range: DataRange; result: { [index: string]: ScatterDataResult } }

export type ErrorResponse = { error: string }

export type ScatterResponse = ScatterDataResponse | ErrorResponse

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

export type ScatterDataResult = {
	colorLegend: ColorLegendEntry[]
	shapeLegend: ShapeLegendEntry[]
	colorMap: ScatterColorMap
	shapeMap: ScatterShapeMap
	samples: any[]
}

export type DataRange = {
	xMin: number
	xMax: number
	yMin: number
	yMax: number
}

export type ScatterChart = {
	chartDiv?: any
	mainG?: any
	xAxis?: any
	axisBottom?: any
	yAxis?: any
	axisLeft?: any
	serie?: any
	lasso?: any
	ranges?: {
		xMin: number
		xMax: number
		yMin: number
		yMax: number
		zMin?: number
		zMax?: number
		scaleMin?: number
		scaleMax?: number
	}
	id: any
	cohortSamples: any
	xAxisScale?: (x: any) => AxisScale<number>
	yAxisScale?: (y: any) => AxisScale<number>
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
	data: ScatterDataResult
	/** The color legend map for the chart */
	colorLegend: Map<string, ColorLegendItem>
	/** The shape legend map for the chart */
	shapeLegend: Map<string, ShapeLegendItem>
	axisG?: any
	labelsG?: any
	/* Sum of samples grouped by month for the events chart*/
	events?: any[]
}
