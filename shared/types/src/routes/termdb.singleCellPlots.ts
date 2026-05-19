import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'
import type { ColorLegendEntry, ShapeLegendEntry } from './termdb.sampleScatter.ts'

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
		/** Maxium number of samples to render on the client side.
		 * If over the cutoff, will return an image instead of sample array.
		 * Matches the maxSvgSamplesCutoff in scatter settings.*/
		cutoff: number
		/** Width of the scatter canvas */
		width: number
		/** Height of the scatter canvas */
		height: number
		/** Radius of the points in the scatter plot. In scatter,
		 * this is the setting size. */
		radius: number
		/** Default or user defined lower limit cutoff for x scale */
		minXScale: number | null
		/** Default or user defined upper limit cutoff for x scale */
		maxXScale: number | null
		/** Default or user defined lower limit cutoff for y scale */
		minYScale: number | null
		/** Default or user defined upper limit cutoff for y scale */
		maxYScale: number | null
		/** Default or user defined opacity for the scatter plot points */
		opacity: number
		/** Required non expression color for scge plots. 'startColor' is the
		 * settings key in the scatter. */
		startColor: string
		/** Required non expression color for scge plots. 'stopColor' is the
		 * settings key in the scatter. */
		stopColor: string
	}
	/** Term wrapper for coloring the single cell plot */
	colorTW?: any
}

export type TermdbSingleCellPlotsResponse = ErrorResponse | ValidSingleCellPlotsResponse

/** The computed coordinate and gene expression range for cells
 * returned in a single request. Scoped to the specific plot type
 * (e.g. "umap", "tsne") and optional sample filter — not a global
 * range across all plots or samples. Used to define axis domains
 * and color scale domains for rendering. */
export type SingleCellRange = {
	/** Minimum x coordinate across all cells in this plot response */
	xMin: number
	/** Maximum x coordinate across all cells in this plot response */
	xMax: number
	/** Minimum y coordinate across all cells in this plot response */
	yMin: number
	/** Maximum y coordinate across all cells in this plot response */
	yMax: number
	/** Minimum gene expression value (Infinity when no expression data) */
	geMin: number
	/** Maximum gene expression value (-Infinity when no expression data) */
	geMax: number
}

/** Returns cell data formatted in samples array for the sampleScatter */
export type FormattedCell2Sample = {
	/** Cell identifier used as the sample id */
	sampleId: string
	/** X coordinate of the cell in the plot */
	x: number
	/** Y coordinate of the cell in the plot */
	y: number
	/** Z coordinate, always 0 (2D plots only) */
	z: number
	/** Cell type or group assignment for coloring */
	category: string
	/** Shape key for the legend, always 'Ref' */
	shape: string
	/** Visibility state based on user-hidden categories */
	hidden: { category: boolean }
	/** Gene expression value for this cell, undefined when not applicable */
	geneExp: number | undefined
}

export type SingleCellPlotDataResult = {
	colorLegend: ColorLegendEntry[]
	shapeLegend: ShapeLegendEntry[]
	samples?: FormattedCell2Sample[]
	/** If over the cutoff, will return image instead of sample array */
	src?: string
	/** When no sample array is returned, send the total sample count for
	 * the legend. */
	totalSampleCount?: number
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
