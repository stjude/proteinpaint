import type { DataEntry } from './termdb.DE.js'

/** Types shared by the three routes (termdb/DE, termdb/diffMeth,
 * termdb/singlecellDEgenes) that embed a server-rendered volcano PNG in
 * their response. This file defines no route payload — the renderer is
 * invoked internally by each route via a shared server helper. */

/** Client-controlled render configuration. All fields are optional; the
 * server helper applies defaults for any missing field so routes can be
 * called without a renderConfig during transition. */
export type VolcanoRenderConfig = {
	/** Plot width in CSS pixels (data area, before dot-radius padding). */
	width?: number
	/** Plot height in CSS pixels (data area, before dot-radius padding). */
	height?: number
	/** Device pixel ratio for high-DPR rendering. */
	devicePixelRatio?: number
	/** Radius of each rendered dot in CSS pixels. */
	pngDotRadius?: number
	/** abs(fold change) cutoff used for significance + top-N eligibility. */
	foldChangeCutoff?: number
	/** -log10 p-value cutoff used for significance coloring. */
	pValueCutoff?: number
	/** Which p-value drives the y-axis and significance check. */
	pValueType?: 'adjusted' | 'original'
	/** Maximum number of interactive points returned in `data`. */
	topN?: number
	/** Hex color for significant "up" (positive fold change). */
	colorSignificantUp?: string
	/** Hex color for significant "down" (negative fold change). */
	colorSignificantDown?: string
	/** Hex color for non-significant points. */
	colorNonsignificant?: string
}

/** Server-rendered volcano plot. Embedded as the `volcano` field in each
 * of the three data-route responses, alongside `data: VolcanoTopPoint[]`. */
export type VolcanoRenderResult = {
	/** Base64-encoded PNG of the rendered plot (no axes; client overlays
	 * SVG axes). */
	png: string
	plotData: VolcanoPlotData
}

export type VolcanoPlotData = {
	x_min: number
	x_max: number
	y_min: number
	y_max: number
	device_pixel_ratio: number
	total_points: number
	num_significant: number
}

/** Top-N point returned in `data[]`. Sorted server-side by -log10(p)
 * descending, after filtering by abs(fold_change) >= foldChangeCutoff.
 * pixel_x / pixel_y are in CSS pixels, pre-computed on the server so the
 * client can do quadtree hover/click without re-scaling. */
export type VolcanoTopPoint = DataEntry & {
	gene_name: string
	/** Present for gene-expression DE (ENSG id). */
	gene_id?: string
	/** Present for DNA methylation (ENCODE CRE promoter id). */
	promoter_id?: string
	pixel_x: number
	pixel_y: number
	color: string
	significant: boolean
	neg_log10_p: number
}
