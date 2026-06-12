import type { Menu } from '#dom'
import { scaleSequential, interpolateBlues, scaleLinear } from 'd3'
import { loadBrainAssets, renderBrainSvg } from './brainRegions.svg'

const NO_DATA_COLOR = '#dcdcdc'
const BRAIN_RENDER_W = 440

// Monotonic counter for unique <linearGradient> ids (Date.now() can collide when the
// brain re-renders within the same millisecond on volcano changes).
let gradientSeq = 0

export type BrainRegionSamplesOpts = {
	/** region code → display name */
	regions: { [code: string]: string }
	/** region code → sample count (case + control) */
	counts: { [code: string]: number }
	templateUrl: string
	svgUrl: string
	/** total distinct samples behind the counts; shown in the title */
	totalSamples: number
	tip: Menu
	/** number of samples whose region value wasn't a configured region */
	unmappedCount?: number
	/** invoked when a region is clicked (e.g. the Protein View volcano sync) */
	onRegionClick?: (code: string, event: MouseEvent) => void
	/** when true for a code, render that region as filtered-out */
	isRegionDimmed?: (code: string) => boolean
}

// Render the brain "sample distribution" view: each region filled by its sample
// count (sequential blues) with a samples-per-region legend. Kept as a standalone
// renderer (not a plot component) so Protein View — and future callers — can embed
// it next to the cohort volcano.
export async function drawBrainRegionSamples(holder: any, opts: BrainRegionSamplesOpts) {
	const { regions, counts, templateUrl, svgUrl, totalSamples, tip } = opts
	const assets = await loadBrainAssets(svgUrl, Object.keys(regions))
	// Title is built live from totalSamples (case + control) so it stays correct as
	// cohorts/regions are hidden.
	const title = `All samples (n=${totalSamples})`
	const max = Math.max(0, ...Object.values(counts))
	const colorScale = scaleSequential(interpolateBlues).domain([0, Math.max(1, max)])

	const container = holder
		.append('div')
		.attr('class', 'sjpp-brain-region-samples-container')
		.style('display', 'flex')
		.style('gap', '20px')
		.style('flex-wrap', 'wrap')
		.style('align-items', 'flex-start')

	renderBrainSvg({
		holder: container,
		width: BRAIN_RENDER_W,
		templateUrl,
		assets,
		regions,
		tip,
		title,
		fillByRegion: (code: string) => {
			const n = counts[code] ?? 0
			return n > 0 ? (colorScale(n) as string) : NO_DATA_COLOR
		},
		tooltipByRegion: (code: string, label: string) => {
			const n = counts[code] ?? 0
			return `${label} (${code})\nSamples: ${n}`
		},
		onRegionClick: opts.onRegionClick,
		isRegionDimmed: opts.isRegionDimmed
	})

	renderSamplesLegend(container, colorScale, max)

	const unmappedCount = opts.unmappedCount ?? 0
	if (unmappedCount > 0) {
		holder
			.append('div')
			.style('margin-top', '4px')
			.style('width', `${BRAIN_RENDER_W}px`)
			.style('text-align', 'right')
			.style('font-size', '11px')
			.style('color', '#888')
			.text(`${unmappedCount} sample${unmappedCount === 1 ? '' : 's'} had unmapped region values`)
	}
}

function renderSamplesLegend(container: any, colorScale: any, max: number) {
	const legendDiv = container
		.append('div')
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('justify-content', 'center')
		.style('padding', '10px')

	legendDiv
		.append('div')
		.style('font-weight', 'bold')
		.style('font-size', '13px')
		.style('margin-bottom', '8px')
		.text('Samples per region')

	const legendWidth = 20
	const legendHeight = 200
	const svg = legendDiv
		.append('svg')
		.attr('width', legendWidth + 60)
		.attr('height', legendHeight + 30)

	const defs = svg.append('defs')
	const gradientId = `brain-samples-gradient-${gradientSeq++}`
	const gradient = defs
		.append('linearGradient')
		.attr('id', gradientId)
		.attr('x1', '0')
		.attr('y1', '0')
		.attr('x2', '0')
		.attr('y2', '1')

	// Gradient is drawn high (max) → low (0), so y1=0 takes color at max.
	const steps = 10
	for (let i = 0; i <= steps; i++) {
		const t = i / steps
		const val = max * (1 - t)
		gradient
			.append('stop')
			.attr('offset', `${t * 100}%`)
			.attr('stop-color', colorScale(val))
	}

	svg
		.append('rect')
		.attr('x', 0)
		.attr('y', 10)
		.attr('width', legendWidth)
		.attr('height', legendHeight)
		.style('fill', `url(#${gradientId})`)
		.attr('stroke', '#999')

	const legendScale = scaleLinear()
		.domain([max, 0])
		.range([10, legendHeight + 10])
	const ticks = max > 0 ? [max, Math.round((max * 3) / 4), Math.round(max / 2), Math.round(max / 4), 0] : [0]
	for (const tick of ticks) {
		const y = legendScale(tick)
		svg
			.append('line')
			.attr('x1', legendWidth)
			.attr('y1', y)
			.attr('x2', legendWidth + 5)
			.attr('y2', y)
			.attr('stroke', '#666')
		svg
			.append('text')
			.attr('x', legendWidth + 8)
			.attr('y', y)
			.attr('dominant-baseline', 'central')
			.attr('font-size', '10px')
			.text(String(tick))
	}

	legendDiv
		.append('div')
		.style('margin-top', '10px')
		.style('font-size', '12px')
		.style('color', '#666')
		.html(
			`<span style="display:inline-block;width:14px;height:14px;background:${NO_DATA_COLOR};border:1px solid #999;vertical-align:middle;margin-right:4px"></span> No samples`
		)
}
