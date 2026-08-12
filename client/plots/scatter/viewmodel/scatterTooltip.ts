import { mclass } from '#shared/common.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getDateStrFromNumber } from '#shared/terms.js'
import { SINGLECELL_GENE_EXPRESSION } from '#types'
import { rgb } from 'd3-color'
import { pointer } from 'd3-selection'
import type { Scatter } from '../scatter'
import { table2col, shapesArray, DataPointInteractions, type ActionMenuItem } from '#dom'

/** Forgiveness margin, in serie-local px, around each dot's rendered radius. */
const HIT_BUFFER_PX = 2
/** Gap between a picked dot's edge and its hover ring, in SCREEN px. */
const HOVER_RING_MARGIN_PX = 2

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

	/** Largest radius any dot in this chart can have — the broad quadtree query must not
	 * under-select before the per-dot filter runs. */
	maxDotRadius(chart) {
		let max = 0
		for (const s of chart.data.samples) max = Math.max(max, this.dotRadius(chart, s))
		return max
	}

	isVisible(s) {
		// getOpacity() honours showRef for reference dots but not refSize == 0
		if (!('sampleId' in s) && (!this.scatter.settings.showRef || this.scatter.settings.refSize == 0)) return false
		return this.scatter.model.getOpacity(s) > 0
	}

	/** Do the two dots' rendered circles touch? This is the definition of "neighbour": dots
	 * that visually sit on top of each other. Both radii and both centers are in serie-local
	 * px, so the answer does not change with zoom — unlike the fixed 5/zoom threshold this
	 * replaced, which caught ~12 dot radii when zoomed out and only coincident dots when
	 * zoomed in. */
	overlaps(chart, a, b) {
		const ca = this.scatter.model.getCoordinates(chart, a)
		const cb = this.scatter.model.getCoordinates(chart, b)
		return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= this.dotRadius(chart, a) + this.dotRadius(chart, b)
	}

	/** Screen px per serie-local px. Reads the composite CTM rather than the zoom state so it
	 * stays right no matter which ancestor carries the transform. */
	screenScale(chart) {
		return chart.serie?.node()?.getScreenCTM()?.a || 1
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

	detach(chartId?: string) {
		if (chartId == undefined) {
			for (const dpi of this.byChart.values()) dpi.detach()
			this.byChart.clear()
			return
		}
		this.byChart.get(chartId)?.detach()
		this.byChart.delete(chartId)
	}

	attachTo(chart) {
		this.detach(chart.id)
		// while the lasso is on it owns the drag over the plot area
		if (this.scatter.config.lassoOn) return
		if (!chart.cover || !chart.data?.samples?.length) return
		const model = this.scatter.model

		const dpi = new DataPointInteractions<any>({
			cover: chart.cover,
			hoverLayer: this.getHoverLayer(chart),
			hoverTip: this.view.dom.tooltip,
			points: chart.data.samples,
			toLocalCoords: event => pointer(event, chart.serie.node()) as [number, number],
			getX: s => model.getCoordinates(chart, s).x,
			getY: s => model.getCoordinates(chart, s).y,
			hitRadius: () => this.maxDotRadius(chart) + HIT_BUFFER_PX,
			perDotRadius: s => this.dotRadius(chart, s),
			perDotBuffer: HIT_BUFFER_PX,
			isHidden: s => !this.isVisible(s),
			// the cursor picks the nearest dot; the cluster then adds every dot whose rendered
			// circle overlaps that one, so "neighbour" means "visibly on top of each other"
			getCluster: (seed, all) => all.filter(s => this.isVisible(s) && this.overlaps(chart, seed, s)),
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

	/** Flat table for the multi-hit hover tooltip and click menu. Mirrors the column set the
	 * lasso's sample table already uses. */
	buildTableData(dots) {
		const config = this.scatter.config
		const labels = config.controlLabels
		const hasName = dots.some(d => d.sample || d.cellId)
		const hasInfo = dots.some(d => 'info' in d)

		const columns: any[] = []
		if (hasName) columns.push({ label: labels?.Sample || this.scatter.settings.itemLabel })
		if (config.term) columns.push({ label: config.term.term.name })
		if (config.term2) columns.push({ label: config.term2.term.name })
		if (config.colorTW) columns.push({ label: config.colorTW.term.name })
		if (config.shapeTW) columns.push({ label: config.shapeTW.term.name })
		if (config.scaleDotTW) columns.push({ label: config.scaleDotTW.term.name, sortable: true })
		if (hasInfo) columns.push({ label: 'Info' })

		const rows = dots.map(d => {
			const row: any[] = []
			if (hasName) row.push({ value: d.sample || d.cellId || '' })
			if (config.term) row.push({ value: this.getCategoryValue('x', d, config.term) })
			if (config.term2) row.push({ value: this.getCategoryValue('y', d, config.term2) })
			if (config.colorTW) row.push({ value: this.getCategoryValue('category', d, config.colorTW) })
			if (config.shapeTW) row.push({ value: this.getCategoryValue('shape', d, config.shapeTW) })
			if (config.scaleDotTW) row.push({ value: this.getCategoryValue('scale', d, config.scaleDotTW) })
			if (hasInfo)
				row.push({
					value:
						'info' in d
							? Object.entries(d.info)
									.map(([k, v]) => `${k}: ${v}`)
									.join(', ')
							: ''
				})
			return row
		})
		return { columns, rows }
	}

	getActions(sample): ActionMenuItem[] {
		const config = this.scatter.config
		const interactivity = this.scatter.interactivity
		const actions: ActionMenuItem[] = []

		if (config.colorTW?.term.type == 'geneVariant')
			actions.push({ label: 'Lollipop', onClick: () => interactivity.openLollipop(config.colorTW.term.name) })

		// the plots below are enabled for cohort samples only, and not in the single cell plot
		if (!('sampleId' in sample) || config.singleCellPlot) return actions
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
		if (category == '') return ''
		let value = d[category]
		if (tw?.term.type == 'geneVariant' && tw.q?.type == 'values') {
			const mutation = value.split(', ')[0]
			for (const id in mclass) {
				const class_info = mclass[id]
				if (mutation == class_info.label) {
					const mname = d.cat_info[category].find(m => m.class == class_info.key).mname
					if (mname && includeMutation) value = `${mname} ${value}`
				}
			}
		}
		if (tw?.term.type == 'date') value = getDateStrFromNumber(value)
		/** Not all scge terms will have a geneExp value, such as when the scge term
		 * is a coordTW. When no geneExp value, value = d[category] is the correct value. */ else if (
			tw?.term.type == SINGLECELL_GENE_EXPRESSION &&
			Number.isFinite(d.geneExp)
		) {
			value = roundValueAuto(d.geneExp)
		} else if (typeof value == 'number' && value % 1 != 0) value = roundValueAuto(value)
		return value
	}
}
