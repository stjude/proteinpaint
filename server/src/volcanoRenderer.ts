import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import type { DataEntry, VolcanoRenderConfig, VolcanoRenderResult, VolcanoPlotData, VolcanoTopPoint } from '#types'

/** Input point expected by the `da` rust binary. Keys match DataEntry so
 * each of the three data routes can pass their entries directly. */
type VolcanoPointInput = DataEntry & {
	gene_name: string
	gene_id?: string
	promoter_id?: string
}

const DEFAULTS = {
	width: 400,
	height: 400,
	devicePixelRatio: 2,
	pngDotRadius: 4,
	foldChangeCutoff: 1,
	pValueCutoff: -Math.log10(0.05),
	pValueType: 'adjusted' as const,
	topN: 50,
	colorSignificantUp: '#377eb8',
	colorSignificantDown: '#e41a1c',
	colorNonsignificant: '#888888'
}

/** Render a volcano plot and select top-N points. Shared by termdb/DE,
 * termdb/diffMeth, and termdb/singlecellDEgenes. Returns the PNG + plot
 * metadata (`volcano`) and the top-N points (`topPoints`) pre-sorted
 * server-side by -log10(p) desc after the fold-change filter. */
export async function renderVolcanoPlot(
	points: VolcanoPointInput[],
	config: VolcanoRenderConfig = {}
): Promise<{
	topPoints: VolcanoTopPoint[]
	volcano: VolcanoRenderResult
}> {
	const c = { ...DEFAULTS, ...config }

	const rustInput = {
		type: 'volcano',
		points: points.map(p => ({
			gene_name: p.gene_name,
			gene_id: p.gene_id,
			fold_change: p.fold_change,
			original_p_value: p.original_p_value,
			adjusted_p_value: p.adjusted_p_value,
			promoter_id: p.promoter_id
		})),
		plot_width: c.width,
		plot_height: c.height,
		device_pixel_ratio: c.devicePixelRatio,
		png_dot_radius: c.pngDotRadius,
		fold_change_cutoff: c.foldChangeCutoff,
		p_value_cutoff: c.pValueCutoff,
		p_value_type: c.pValueType,
		top_n: c.topN,
		color_significant_up: c.colorSignificantUp,
		color_significant_down: c.colorSignificantDown,
		color_nonsignificant: c.colorNonsignificant
	}

	const start = Date.now()
	const rsResult = await run_rust('da', JSON.stringify(rustInput))
	mayLog(`[volcanoRenderer] Rust render took ${formatElapsedTime(Date.now() - start)}`)

	const parsed = JSON.parse(rsResult)
	if (!parsed?.png) throw new Error('da: missing PNG data in rust output')

	const { points: topPoints, ...plotData } = parsed.plot_data as VolcanoPlotData & { points: VolcanoTopPoint[] }

	return {
		topPoints,
		volcano: {
			png: parsed.png,
			plotData
		}
	}
}
