import type { RoutePayload } from './routeApi.js'

/** Pure rendering route: takes pre-computed volcano data points + render config,
 *  returns a server-rendered PNG plus the top-N interactive points (with pixel
 *  coordinates for client-side hover/click via quadtree). */
export type VolcanoPlotRequest = {
	/** All data points to render in the PNG. Selection of the top-N
	 *  interactive points is done server-side. */
	points: VolcanoPointInput[]
	/** Plot dimensions in CSS pixels (PNG is rendered at width * dpr). */
	width: number
	height: number
	devicePixelRatio: number
	/** Radius of each rendered dot in CSS pixels. */
	pngDotRadius: number
	/** abs(log2 fold change) cutoff. Points below this are not eligible for
	 *  the top-N interactive set, but are still rendered in the PNG. */
	foldChangeCutoff: number
	/** -log10 p-value cutoff (used for significance coloring). */
	pValueCutoff: number
	/** Which p-value to use for the y-axis and significance check. */
	pValueType: 'adjusted' | 'original'
	/** Maximum number of interactive points to return. */
	topN: number
	/** Hex colors used to render and color-code the dots. */
	colorSignificantUp: string
	colorSignificantDown: string
	colorNonsignificant: string
}

export type VolcanoPointInput = {
	gene: string
	/** log2(fold change) */
	log2_fold_change: number
	original_p_value: number
	adjusted_p_value: number
	/** Optional, for DNA methylation volcano. */
	promoter_id?: string
}

export type VolcanoPlotResponse = {
	/** Base64-encoded PNG of the rendered plot (no axes; client overlays SVG axes). */
	png: string
	plotData: VolcanoPlotData
}

export type VolcanoPlotData = {
	/** Top-N interactive points (filtered by fold change cutoff, sorted by
	 *  -log10(p_value) descending). pixel_x/pixel_y are in CSS pixels. */
	points: VolcanoInteractivePoint[]
	x_min: number
	x_max: number
	y_min: number
	y_max: number
	device_pixel_ratio: number
	total_points: number
	num_significant: number
}

export type VolcanoInteractivePoint = {
	gene: string
	promoter_id?: string
	log2_fold_change: number
	original_p_value: number
	adjusted_p_value: number
	neg_log10_p: number
	significant: boolean
	color: string
	pixel_x: number
	pixel_y: number
}

export const volcanoPlotPayload: RoutePayload = {
	request: {
		typeId: 'VolcanoPlotRequest'
	},
	response: {
		typeId: 'VolcanoPlotResponse'
	}
}
