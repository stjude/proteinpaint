import { mclass } from '#shared/common.js'
import { rgb } from 'd3-color'
import { pointer } from 'd3-selection'
import type { Scatter } from '../scatter'
import { table2col, shapesArray, DataPointInteractions, type ActionMenuItem } from '#dom'
import { getCategoryValue, buildSampleTableData } from './scatterSampleTable'

/** Forgiveness margin around each dot's rendered edge, in SCREEN px. Kept in screen units
 * so the grab area feels the same at any zoom — in serie-local units it would inflate along
 * with the dots, reaching 30px of slop at 10x. */
export const HIT_BUFFER_PX = 3
/** Gap between a picked dot's edge and its hover ring, in SCREEN px. Slightly tighter than
 * HIT_BUFFER_PX: the ring marks the dot, it is not meant to trace the whole hit zone. */
export const HOVER_RING_MARGIN_PX = 2

/**
 * Adapter between the scatter plot and the shared cover -> quadtree -> hover ring ->
 * tooltip pipeline in `#dom/dataPointInteractions` (the same one manhattan/GRIN2 and the
 * volcano plots use). This class owns only the scatter-specific parts: what a tooltip row
 * says about a sample, and which actions a sample offers on click.
 *
 * Coordinates: the quadtree is built in `chart.serie`'s local space (what
 * `model.getCoordinates()` returns), which is untouched by zoom — `scatterZoom` puts the
 * d3-zoom transform on `chart.serie` itself. `pointer(event, chart.serie.node())` inverts
 * the full screen CTM, so the mouse lands in that same space at any zoom/pan and the
 * quadtree never needs rebuilding.
 */
export class ScatterTooltip {
	scatter: Scatter
	view: any
	/** One DataPointInteractions per chart; a term0 divide-by renders several charts. */
	byChart: Map<string, DataPointInteractions<any>> = new Map()

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.view = scatter.view
	}

	/** Rendered radius of a dot in serie-local px. `transform()` draws each shape in a 16x16
	 * box scaled by `getScale()`, so the radius is half of that. `getScale()` already accounts
	 * for scaleDotTW sizing, the reference cloud's refSize, and the search-match enlargement,
	 * and is zoom-invariant for the svg view. */
	dotRadius(chart, s) {
		return 8 * this.scatter.model.getScale(chart, s)
	}

	/** Projected center + rendered radius of every dot, built once per attach. Hover fires on
	 * every mousemove, so recomputing this per event turned plain cursor movement into an O(n)
	 * sweep of d3 scale calls over up to maxSvgSamplesCutoff (20k) samples. Everything it
	 * depends on — the axis scales and the size settings — is fixed for the life of an attach,
	 * and any change to them re-renders, which re-attaches. */
	buildGeom(chart) {
		const geom = new Map<any, { x: number; y: number; r: number }>()
		let maxR = 0
		for (const s of chart.data.samples) {
			const { x, y } = this.scatter.model.getCoordinates(chart, s)
			const r = this.dotRadius(chart, s)
			if (r > maxR) maxR = r
			geom.set(s, { x, y, r })
		}
		return { geom, maxR }
	}

	isVisible(s) {
		// getOpacity() honours showRef for reference dots but not refSize == 0
		if (s.isRef && (!this.scatter.settings.showRef || this.scatter.settings.refSize == 0)) return false
		return this.scatter.model.getOpacity(s) > 0
	}

	/** Is `b` inside the hover neighbourhood of `a`? The reach is the two dots' radii added
	 * together — "close enough that they would overlap at 100%" — but held constant in SCREEN
	 * px, so it does not stretch as you zoom.
	 *
	 * Plain circle overlap looks zoom-invariant (uniform scaling preserves it) but is not what
	 * the eye sees: the dots themselves grow with zoom, so at 11x a pair that merely touches
	 * spans ~48 screen px and the tooltip reports dots strewn right across the plot. Dividing
	 * the reach by the current scale pins it at ~4px on screen at any zoom, matching the
	 * screen-constant neighbourhood the old 5/zoom threshold happened to give. At 1x this is
	 * exactly circle overlap; it only bites once zoom would have inflated it.
	 *
	 * `scale` is screenScale(chart), hoisted by the caller — it is a layout read, and this runs
	 * once per sample. */
	isNeighbour(chart, a, b, scale = this.screenScale(chart)) {
		const ca = this.scatter.model.getCoordinates(chart, a)
		const cb = this.scatter.model.getCoordinates(chart, b)
		const reach = (this.dotRadius(chart, a) + this.dotRadius(chart, b)) / scale
		return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= reach
	}

	/** Screen px per serie-local px. Reads the composite CTM rather than the zoom state so it
	 * stays right no matter which ancestor carries the transform. */
	screenScale(chart) {
		return chart.serie?.node()?.getScreenCTM()?.a || 1
	}

	/** Serie-local px that a constant SCREEN-px length occupies at the current zoom. */
	fromScreenPx(chart, px) {
		return px / this.screenScale(chart)
	}

	/** How close the cursor must get to a dot's center to pick it, in serie-local px: the
	 * radius you can see, plus a forgiveness margin that stays the same size on screen at any
	 * zoom. Leaving the margin in serie-local px would inflate it with everything else — at
	 * 10x zoom a 3px slop becomes 30 screen px of grab area around every dot. */
	hitRadiusFor(chart, s) {
		return this.dotRadius(chart, s) + this.fromScreenPx(chart, HIT_BUFFER_PX)
	}

	/** Scale factor passed to model.transform() to draw the hover ring. The gap is a constant
	 * number of SCREEN px, not a fixed multiple of the dot: a 1.6x ring is snug on a 2px dot
	 * but becomes a fat halo once zoom has blown the same dot up to 18px. */
	hoverRingFactor(chart, s) {
		const r = this.dotRadius(chart, s)
		if (!r) return 1
		return 1 + HOVER_RING_MARGIN_PX / this.screenScale(chart) / r
	}

	/** Rings are drawn inside chart.serie so they inherit the zoom transform and track their
	 * dots. renderSerie() wipes chart.serie, so (re)create the layer lazily. */
	getHoverLayer(chart) {
		let g = chart.serie.select('g.sjpp-scatter-hover')
		if (g.empty()) g = chart.serie.append('g').attr('class', 'sjpp-scatter-hover').attr('pointer-events', 'none')
		return g
	}

	/** destroy() rather than detach(): attachTo() builds a fresh DataPointInteractions on every
	 * renderSerie, and each one owns a Menu that adds a div to <body> plus a body-level
	 * mousedown listener. detach() alone would leave both behind on every render. */
	detach(chartId?: string) {
		if (chartId == undefined) {
			for (const dpi of this.byChart.values()) dpi.destroy()
			this.byChart.clear()
			return
		}
		this.byChart.get(chartId)?.destroy()
		this.byChart.delete(chartId)
	}

	attachTo(chart) {
		this.detach(chart.id)
		// while the lasso is on it owns the drag over the plot area
		if (this.scatter.config.lassoOn) return
		if (!chart.cover || !chart.data?.samples?.length) return
		const model = this.scatter.model
		const { geom, maxR } = this.buildGeom(chart)

		const dpi = new DataPointInteractions<any>({
			cover: chart.cover,
			hoverLayer: this.getHoverLayer(chart),
			hoverTip: this.view.dom.tooltip,
			points: chart.data.samples,
			toLocalCoords: event => pointer(event, chart.serie.node()) as [number, number],
			getX: s => geom.get(s)!.x,
			getY: s => geom.get(s)!.y,
			// broad quadtree query; must not under-select before the per-dot filter runs
			hitRadius: () => maxR + this.fromScreenPx(chart, HIT_BUFFER_PX),
			perDotRadius: s => geom.get(s)!.r + this.fromScreenPx(chart, HIT_BUFFER_PX),
			isHidden: s => !this.isVisible(s),
			// the cursor picks the nearest dot; the cluster then adds every dot whose rendered
			// circle overlaps that one, so "neighbour" means "visibly on top of each other".
			// sorted nearest-first because the module truncates this list to maxTooltipRows —
			// in chart.data.samples order the dot actually under the cursor could be cut.
			getCluster: (seed, all) => {
				const a = geom.get(seed)!
				// one layout read for the whole sweep, not one per sample
				const scale = this.screenScale(chart)
				return all
					.filter(s => {
						if (!this.isVisible(s)) return false
						const b = geom.get(s)!
						return Math.hypot(a.x - b.x, a.y - b.y) <= (a.r + b.r) / scale
					})
					.sort((s1, s2) => {
						const b1 = geom.get(s1)!,
							b2 = geom.get(s2)!
						return Math.hypot(a.x - b1.x, a.y - b1.y) - Math.hypot(a.x - b2.x, a.y - b2.y)
					})
			},
			toHoverSpec: s => ({
				path: model.getShape(chart, s),
				transform: model.transform(chart, s, this.hoverRingFactor(chart, s)),
				stroke: 'black',
				fill: 'none'
			}),
			maxTooltipRows: this.scatter.settings.maxTooltipRows,
			itemNoun: this.scatter.settings.itemLabel.toLowerCase(),
			renderSingleHoverTooltip: (s, container) => this.renderSampleRows(s, chart, container),
			buildMultiHitTableData: dots => this.buildTableData(dots),
			getActions: s => this.getActions(s),
			renderSingleHitInfo: (s, container) => this.renderSampleRows(s, chart, container),
			getRowKey: s => s.sample || s.cellId || String(s.sampleId ?? `${s.x},${s.y}`)
		})
		dpi.attach()
		// namespaced so it sits alongside the module's own click handler rather than replacing it
		chart.cover.on('click.sjpp-scatter-searchmenu', () => this.scatter.interactivity.searchMenu?.hide())
		this.byChart.set(chart.id, dpi)
	}

	getTW(category) {
		switch (category) {
			case 'category':
				return this.scatter.config.colorTW
			case 'shape':
				return this.scatter.config.shapeTW
			case 'scale':
				return this.scatter.config.scaleDotTW
			case 'x':
				return this.scatter.config.term
			case 'y':
				return this.scatter.config.term2
			default:
				return null
		}
	}

	/** Two-column detail view of one sample, shared by the hover tooltip and the click
	 * action menu. */
	renderSampleRows(sample, chart, container) {
		const config = this.scatter.config
		const table = table2col({ holder: container.append('div'), disableScroll: true, cellPadding: '5px' })

		if (config.term) {
			table.addRow(config.term.term.name, this.getCategoryValue('x', sample, config.term))
			if (config.term2) table.addRow(config.term2.term.name, this.getCategoryValue('y', sample, config.term2))
		}
		if (sample.category != 'Ref') {
			if (config.colorTW) this.addTermRow(table, 'category', sample, chart)
			if (config.shapeTW) this.addTermRow(table, 'shape', sample, chart)
			if (config.scaleDotTW)
				table.addRow(config.scaleDotTW.term.name, this.getCategoryValue('scale', sample, config.scaleDotTW))
		}

		if ('info' in sample) for (const [k, v] of Object.entries(sample.info)) table.addRow(k, v)
		const name = sample.sample || sample.cellId
		if (name) table.addRow(this.scatter.settings.itemLabel, name)
	}

	/** A color/shape term row, drawn with the dot's own glyph so the tooltip matches the plot. */
	addTermRow(table, category: 'category' | 'shape', sample, chart) {
		const tw = this.getTW(category)
		const [tdlabel, td] = table.addRow()
		tdlabel.text(tw.term.name)

		const isColor = category == 'category'
		const color = isColor
			? this.scatter.model.getColor(sample, chart)
			: this.scatter.config.colorTW
			? 'gray'
			: this.scatter.settings.defaultColor
		const shapeKey = isColor ? 'Ref' : sample.shape
		const shape = shapesArray[chart.shapeLegend.get(shapeKey).shape % shapesArray.length]

		let value = this.getCategoryValue(category, sample, tw)
		let fontColor = 'black'
		if (tw?.term.type == 'geneVariant' && tw.q.type == 'values') {
			const whiteColor = rgb('white').toString()
			for (const id in mclass) {
				const class_info = mclass[id]
				if (!value.toString().includes(class_info.label)) continue
				if (rgb(class_info.color).toString() != whiteColor) fontColor = class_info.color
				value = this.getCategoryValue(category, sample, tw, true)
				break
			}
		}

		const svg = td
			.append('svg')
			.attr('width', value.toString().length * 9 + 60)
			.attr('height', '25px')
		const g = svg.append('g').attr('transform', 'translate(0, 14)')
		g.append('path')
			.attr('d', shape)
			.attr('fill', color)
			.attr('stroke', '#aaa')
			.attr('transform', 'translate(0, -4) scale(0.6)')
		g.append('text')
			.attr('x', 15)
			.attr('y', 6)
			.attr('font-size', '0.9em')
			.append('tspan')
			.text(value)
			.attr('fill', fontColor)
	}

	/** Flat table for the multi-hit hover tooltip and click menu. */
	buildTableData(dots) {
		return buildSampleTableData(this.scatter.config, this.scatter.settings.itemLabel, dots)
	}

	getActions(sample): ActionMenuItem[] {
		const config = this.scatter.config
		const interactivity = this.scatter.interactivity
		const actions: ActionMenuItem[] = []

		// reference-cloud dots carry no mutation data, so none of these apply to them; the plots below are
		// also for cohort samples only, and not in the single cell plot. A cohort dot from a request not
		// authorized to display sample ids has no sampleId (the server dropped it), so gate every
		// sample-specific action when the real id is absent — it would submit nothing / build an empty filter.
		if (sample.isRef || sample.sampleId == null || config.singleCellPlot) return actions

		// the gene may be carried by either term — the old tooltip offered Lollipop from
		// whichever of the color/shape rows happened to be a geneVariant
		const geneTW = [config.colorTW, config.shapeTW].find(tw => tw?.term.type == 'geneVariant')
		if (geneTW) actions.push({ label: 'Lollipop', onClick: () => interactivity.openLollipop(geneTW.term.name) })

		const queries = this.scatter.state.termdbConfig.queries
		if (this.scatter.state.currentCohortChartTypes.includes('sampleView'))
			actions.push({ label: 'Sample view', onClick: () => interactivity.openSampleView(sample) })
		if (queries?.singleSampleMutation)
			actions.push({ label: 'Disco', onClick: () => interactivity.openDiscoPlot(sample) })
		if (queries?.singleSampleGenomeQuantification)
			actions.push({ label: 'Met Array', onClick: () => interactivity.openMetArray(sample) })
		return actions
	}

	getCategoryValue(category, d, tw, includeMutation = false) {
		return getCategoryValue(category, d, tw, includeMutation)
	}
}
