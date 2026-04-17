import type { VolcanoPlotRequest, VolcanoPlotResponse, RouteApi } from '#types'
import { volcanoPlotPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'

/**
 * Pure rendering route for volcano plots.
 * Takes pre-computed points + render config, dispatches to the Rust
 * `volcano_plot` binary, and returns the PNG plus top-N interactive points.
 *
 * Top-N selection (server-side, in Rust):
 *   1. Filter points where abs(log2_fold_change) >= foldChangeCutoff
 *   2. Sort filtered points by -log10(p_value) descending
 *   3. Take top N
 *
 * The PNG contains all points; only the top N include pixel coordinates for
 * client-side hover/click via quadtree.
 */
export const api: RouteApi = {
	endpoint: 'termdb/volcanoPlot',
	methods: {
		get: { ...volcanoPlotPayload, init },
		post: { ...volcanoPlotPayload, init }
	}
}

function init() {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as VolcanoPlotRequest

			if (!Array.isArray(q.points)) throw new Error('points[] required')

			const rustInput = {
				type: 'volcano',
				points: q.points,
				plot_width: q.width,
				plot_height: q.height,
				device_pixel_ratio: q.devicePixelRatio,
				png_dot_radius: q.pngDotRadius,
				fold_change_cutoff: q.foldChangeCutoff,
				p_value_cutoff: q.pValueCutoff,
				p_value_type: q.pValueType,
				top_n: q.topN,
				color_significant_up: q.colorSignificantUp,
				color_significant_down: q.colorSignificantDown,
				color_nonsignificant: q.colorNonsignificant
			}

			const start = Date.now()
			const rsResult = await run_rust('volcano_plot', JSON.stringify(rustInput))
			mayLog(`[volcanoPlot] Rust render took ${formatElapsedTime(Date.now() - start)}`)

			const parsed = JSON.parse(rsResult)
			if (!parsed?.png) throw new Error('Invalid Rust output: missing PNG data')

			const response: VolcanoPlotResponse = {
				png: parsed.png,
				plotData: parsed.plot_data
			}
			res.send(response)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
