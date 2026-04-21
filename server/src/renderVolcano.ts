import { run_rust } from '@sjcrh/proteinpaint-rust'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from '#types'
import { mayLog } from './helpers.ts'
import { formatElapsedTime } from '#shared'

/**
 * Pipe a full row set into the `volcano` Rust binary, which rasterizes the
 * volcano PNG and returns the threshold-passing rows (already sorted ascending
 * by the chosen p-value column) as `dots`.
 *
 * The returned `VolcanoData<T>` is meant to be nested under `data` on each
 * route's response — sibling to route-specific metadata (sample sizes, method).
 */
export async function renderVolcano<T extends DataEntry>(
	rows: T[],
	req: VolcanoRenderRequest
): Promise<VolcanoData<T>> {
	const input = {
		rows,
		p_value_type: req.significanceThresholds.pValueType,
		p_value_cutoff: req.significanceThresholds.pValueCutoff,
		fold_change_cutoff: req.significanceThresholds.foldChangeCutoff,
		pixel_width: req.pixelWidth,
		pixel_height: req.pixelHeight,
		color_significant: req.colorSignificant ?? '#d62728',
		color_significant_up: req.colorSignificantUp ?? null,
		color_significant_down: req.colorSignificantDown ?? null,
		color_nonsignificant: req.colorNonsignificant ?? '#000000',
		dot_radius: req.dotRadius ?? 2.0,
		max_interactive_dots: req.maxInteractiveDots ?? null
	}
	const t0 = Date.now()
	const raw = await run_rust('volcano', JSON.stringify(input))
	mayLog(`Time taken to render volcano PNG (${rows.length} rows):`, formatElapsedTime(Date.now() - t0))
	const out = JSON.parse(raw) as {
		png: string
		plot_extent: {
			x_min: number
			x_max: number
			y_min: number
			y_max: number
			pixel_width: number
			pixel_height: number
			plot_left: number
			plot_top: number
			plot_right: number
			plot_bottom: number
			min_nonzero_p: number
		}
		dots: T[]
		total_rows: number
	}
	return {
		dots: out.dots,
		volcanoPng: out.png,
		plotExtent: {
			xMin: out.plot_extent.x_min,
			xMax: out.plot_extent.x_max,
			yMin: out.plot_extent.y_min,
			yMax: out.plot_extent.y_max,
			pixelWidth: out.plot_extent.pixel_width,
			pixelHeight: out.plot_extent.pixel_height,
			plotLeft: out.plot_extent.plot_left,
			plotTop: out.plot_extent.plot_top,
			plotRight: out.plot_extent.plot_right,
			plotBottom: out.plot_extent.plot_bottom,
			minNonZeroPValue: out.plot_extent.min_nonzero_p
		},
		totalRows: out.total_rows
	}
}
