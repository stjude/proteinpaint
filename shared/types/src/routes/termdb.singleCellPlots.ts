import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'
import type { ColorLegendEntry, ShapeLegendEntry } from './termdb.sampleScatter.ts'
import type { Cell } from './termdb.singlecellData.ts'

export type TermdbSingleCellPlotsRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	singleCellPlot: {
		/** Name of the single cell plot type, e.g. "umap", "tsne" */
		name: string
		/** Sample name, optional */
		sample?: string
	}
	/** When sample size is too large, canvas rendering uses
	 * these settings to control how the plot is rendered. */
	canvasSettings: {
		cutoff?: number
		width?: number
		height?: number
		radius?: number
		minXScale?: number
		maxXScale?: number
		minYScale?: number
		maxYScale?: number
		noExpColor?: string
		expColor?: string
		opacity?: number
	}
	/** Optional term wrapper for coloring the single cell plot */
	colorTW?: any
}

export type TermdbSingleCellPlotsResponse = ErrorResponse | ValidSingleCellPlotsResponse

export type SingleCellRange = {
	xMin: number
	xMax: number
	yMin: number
	yMax: number
	/** Gene expression min */
	geMin: number | undefined
	/** Gene expression min */
	geMax: number | undefined
}

export type SingleCellPlotDataResult = {
	colorLegend: ColorLegendEntry[]
	shapeLegend: ShapeLegendEntry[]
	/** Returns cell data forrmatted in samples array for the sampleScatter */
	samples?: Cell[]
	/** If over the cutoff, will return image instead of sample array */
	src?: string
}

export type ValidSingleCellPlotsResponse = {
	range: SingleCellRange
	result: { Default: SingleCellPlotDataResult }
}

export const termdbSingleCellPlotsPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSingleCellPlotsRequest'
	},
	response: {
		typeId: 'TermdbSingleCellPlotsResponse'
	}
	// examples: []
}
