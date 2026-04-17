import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { quadtree, type Quadtree } from 'd3-quadtree'
import { axisstyle, table2col, renderTable } from '#dom'
import type {
	DataPointEntry,
	VolcanoDom,
	VolcanoPlotDimensions,
	VolcanoPlotDom,
	VolcanoViewData
} from '../VolcanoTypes'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { VolcanoInteractivePoint, VolcanoPlotData } from '#types'
import { addTooltipRows, addClickMenuActions } from './DataPointMouseEvents'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import type { ValidatedVolcanoSettings } from '../settings/Settings'

/** Find all interactive points within `hitRadius` pixels of (mx, my). */
function findPointsInRadius(
	qt: Quadtree<VolcanoInteractivePoint>,
	mx: number,
	my: number,
	hitRadius: number
): Array<{ point: VolcanoInteractivePoint; distance: number }> {
	const candidates: Array<{ point: VolcanoInteractivePoint; distance: number }> = []
	qt.visit((node: any, x1, y1, x2, y2) => {
		if (x1 > mx + hitRadius || x2 < mx - hitRadius || y1 > my + hitRadius || y2 < my - hitRadius) return true
		if (!node.length) {
			let current: any = node
			while (current) {
				const p = current.data
				if (p) {
					const dist = Math.sqrt((mx - p.pixel_x) ** 2 + (my - p.pixel_y) ** 2)
					if (dist <= hitRadius) candidates.push({ point: p, distance: dist })
				}
				current = current.next
			}
		}
		return false
	})
	return candidates
}

export class VolcanoPlotView {
	dom: VolcanoDom
	interactions: VolcanoInteractions
	settings: any
	termType: string
	volcanoDom: VolcanoPlotDom
	viewData: VolcanoViewData
	png: string
	plotData: VolcanoPlotData
	/** Lookup from gene identifier (gene_name or promoter_id) to the full
	 *  DataPointEntry, so the interactive hover/click can access fields not
	 *  returned by the pure renderer (chr, start, stop for DMR actions). */
	private pointByKey: Map<string, DataPointEntry>
	/** SVG group where transient highlight circles are drawn (hover + table-sync). */
	private hoverLayer: any
	/** PNG placement + sizing, cached so p-value table hover can reuse. */
	private pngLayout!: { dotRadius: number; pngWidth: number; pngHeight: number; pngLeft: number; pngTop: number }

	constructor(
		dom: VolcanoDom,
		settings: ValidatedVolcanoSettings,
		viewData: VolcanoViewData,
		interactions: VolcanoInteractions,
		termType: string,
		png: string,
		plotData: VolcanoPlotData
	) {
		this.dom = dom
		this.interactions = interactions
		this.settings = settings
		this.viewData = viewData
		this.termType = termType
		this.png = png
		this.plotData = plotData
		this.pointByKey = this.buildPointLookup()

		const actions = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-actions')
			.style('display', 'block')
			.style('z-index', 1)
			.style('position', 'relative')

		// The SVG holder must be wrapped in a positioned div so the cover div
		// (absolutely positioned over the PNG) can overlay the plot area.
		const svgWrap = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-svg-wrap')
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')

		const svg = svgWrap
			.append('svg')
			.style('display', 'inline-block')
			.attr('id', 'sjpp-volcano-svg')
			.style('vertical-align', 'top')

		this.volcanoDom = {
			actions,
			svg,
			top: svg.append('g').attr('id', 'sjpp-volcano-top'),
			xAxis: svg.append('g').attr('id', 'sjpp-volcano-xAxis'),
			yAxis: svg.append('g').attr('id', 'sjpp-volcano-yAxis'),
			xAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-xAxisLabel').attr('text-anchor', 'middle'),
			yAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-yAxisLabel').attr('text-anchor', 'middle'),
			plot: svg.append('g').attr('id', 'sjpp-volcano-plot'),
			pValueTable: this.dom.holder.append('div').attr('id', 'sjpp-volcano-pValueTable').style('display', 'none')
		}

		const plotDim = this.viewData.plotDim
		this.renderUserActions()
		this.renderPlot(plotDim)
		this.renderServerImage(plotDim, svgWrap)
		this.renderFoldChangeLine(plotDim)
		this.renderStatsMenu()
		this.renderPValueTable()
	}

	/** Map gene_name (or promoter_id for DNA methylation) to its full
	 *  DataPointEntry so we can enrich server-returned interactive points. */
	buildPointLookup(): Map<string, DataPointEntry> {
		const map = new Map<string, DataPointEntry>()
		for (const d of this.viewData.pointData) {
			const key = (this.termType === DNA_METHYLATION ? (d as any).promoter_id : d.gene_name) as string
			if (key) map.set(key, d)
		}
		return map
	}

	renderUserActions() {
		this.dom.actionsTip.d.style('overflow', 'hidden')
		this.volcanoDom.actions.style('margin-left', '20px').style('padding', '5px')
		this.addActionButton('Confounding factors', [GENE_EXPRESSION, DNA_METHYLATION], () =>
			this.interactions.confoundersMenu()
		)
		this.addActionButton('Highlight genes', [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], () =>
			this.interactions.launchGeneSetEdit()
		)
		this.addActionButton('Statistics', [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], () => {
			this.renderStatsMenu()
		})
		const sigLabel =
			this.termType == DNA_METHYLATION ? 'Number of significant promoters' : 'Number of significant genes'
		const numSigGenes = this.viewData.statsData.find(d => d.label == sigLabel)?.value
		if (numSigGenes) {
			const sigText = this.termType == DNA_METHYLATION ? `${numSigGenes} DM promoters:` : `${numSigGenes} DE genes:`
			this.volcanoDom.actions.append('span').text(sigText).style('margin-left', '10px').style('font-weight', 'bold')

			this.addActionButton('Show p-value table', [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], () => {
				this.volcanoDom.pValueTable.style(
					'display',
					this.volcanoDom.pValueTable.style('display') == 'none' ? 'inline-block' : 'none'
				)
			})
		}
		if (numSigGenes && numSigGenes >= 3) {
			this.addActionButton(
				`Hierarchical clustering of ${numSigGenes > 100 ? 'top 100' : numSigGenes} DE genes`,
				[GENE_EXPRESSION],
				async () => {
					await this.interactions.launchDEGClustering()
				}
			)
		}
	}

	addActionButton(text: string, termTypes: string[], callback: any) {
		if (this.viewData.userActions.noShow.has(text)) return
		if (!termTypes.includes(this.termType)) return
		const button = this.volcanoDom.actions
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('margin', '3px')
			.style('padding', '3px')
			.text(text)
			.on('click', () => {
				this.dom.actionsTip.clear().showunder(button.node())
				callback()
			})
	}

	/** Compute PNG placement. The PNG is slightly larger than the plot
	 *  rectangle (padded by dot radius on each side) so edge dots can
	 *  overflow visibly beyond the axis bounds. The PNG's inner region
	 *  (offset by dotRadius) aligns with the plot rect. Axes/scales still
	 *  use the plot rect dimensions. */
	private computePngLayout(plotDim: VolcanoPlotDimensions) {
		const dotRadius = Math.max(2, Math.round(Math.max(this.settings.width, this.settings.height) / 80))
		return {
			dotRadius,
			pngWidth: plotDim.plot.width + 2 * dotRadius,
			pngHeight: plotDim.plot.height + 2 * dotRadius,
			pngLeft: plotDim.plot.x - dotRadius,
			pngTop: plotDim.plot.y - dotRadius
		}
	}

	renderPlot(plotDim: VolcanoPlotDimensions) {
		this.volcanoDom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.renderTermInfo(plotDim)

		this.volcanoDom.yAxisLabel.attr(
			'transform',
			`translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`
		)
		this.setSvgSubscriptLabel(this.volcanoDom.yAxisLabel, '-log', '10', `(${this.settings.pValueType} p-value)`)

		this.volcanoDom.xAxisLabel.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
		this.setSvgSubscriptLabel(this.volcanoDom.xAxisLabel, 'log', '2', '(fold-change)')

		// Override just the scale functions with domains matching the
		// server-rendered PNG; keep the view model's x/y axis positions so
		// axes render with their original offset from the plot rect.
		const xScaleFn = scaleLinear().domain([this.plotData.x_min, this.plotData.x_max]).range([0, plotDim.plot.width])
		const yScaleFn = scaleLinear().domain([this.plotData.y_min, this.plotData.y_max]).range([plotDim.plot.height, 0])
		plotDim.xScale.scale = xScaleFn
		plotDim.yScale.scale = yScaleFn

		this.renderScale(plotDim.xScale)
		this.renderScale(plotDim.yScale, true)

		// Plot rect is drawn later, in renderServerImage(), AFTER the PNG
		// <image> element so the border sits on top of the image.
	}

	/** Add the server-rendered PNG plus a cover div for quadtree-based hover/click. */
	renderServerImage(plotDim: VolcanoPlotDimensions, svgWrap: any) {
		const { dotRadius, pngWidth, pngHeight, pngLeft, pngTop } = this.computePngLayout(plotDim)
		this.pngLayout = { dotRadius, pngWidth, pngHeight, pngLeft, pngTop }

		this.volcanoDom.plot
			.append('image')
			.attr('href', `data:image/png;base64,${this.png}`)
			.attr('x', pngLeft)
			.attr('y', pngTop)
			.attr('width', pngWidth)
			.attr('height', pngHeight)

		// Plot rect border drawn AFTER the image so it sits clearly on top,
		// matching the crisp bounding box the old SVG had.
		const plot = this.viewData.plotDim.plot
		this.volcanoDom.plot
			.append('rect')
			.attr('x', plot.x)
			.attr('y', plot.y)
			.attr('width', plot.width)
			.attr('height', plot.height)
			.attr('stroke', '#ccc')
			.attr('fill', 'none')
			.attr('shape-rendering', 'crispEdges')
			.attr('pointer-events', 'none')

		// SVG layers on top of the PNG:
		//   1. Persistent highlights for genes in config.highlightedData
		//   2. Transient hover highlight drawn on mousemove / table-row hover
		// Persistent is drawn first so transient can appear above it.
		this.renderPersistentHighlights()
		const hoverLayer = this.volcanoDom.plot.append('g').attr('id', 'sjpp-volcano-hover-layer')
		this.hoverLayer = hoverLayer

		// Cover div for mouse events — absolutely positioned over the PNG in
		// the wrapping div. Avoids SVG nesting/event-propagation gotchas.
		const cover = svgWrap
			.append('div')
			.attr('id', 'sjpp-volcano-cover')
			.style('position', 'absolute')
			.style('left', `${pngLeft}px`)
			.style('top', `${pngTop}px`)
			.style('width', `${pngWidth}px`)
			.style('height', `${pngHeight}px`)
			.style('pointer-events', 'all')

		const qt = quadtree<VolcanoInteractivePoint>()
			.x(p => p.pixel_x)
			.y(p => p.pixel_y)
			.addAll(this.plotData.points)

		const hitRadius = dotRadius + 3
		let clickMenuOpen = false
		this.dom.clickTip.onHide = () => {
			clickMenuOpen = false
		}

		cover
			.on('mousemove', (event: any) => {
				if (clickMenuOpen) return
				const rect = (cover.node() as HTMLElement).getBoundingClientRect()
				const mx = event.clientX - rect.left
				const my = event.clientY - rect.top
				const candidates = findPointsInRadius(qt, mx, my, hitRadius)
				hoverLayer.selectAll('*').remove()
				if (candidates.length === 0) {
					this.dom.hoverTip.hide()
					return
				}
				candidates.sort((a, b) => a.distance - b.distance)
				const nearest = candidates[0].point
				const full = this.resolvePoint(nearest)
				if (!full) return

				// Draw a highlight at the nearest point: fill with the user's
				// highlight color from the burger menu, stroked to match the
				// point's own color.
				hoverLayer
					.append('circle')
					.attr('cx', pngLeft + nearest.pixel_x)
					.attr('cy', pngTop + nearest.pixel_y)
					.attr('r', dotRadius + 1)
					.attr('fill', this.settings.defaultHighlightColor || '#ffa200')
					.attr('fill-opacity', 0.9)
					.attr('stroke', nearest.color || 'black')
					.attr('stroke-width', 1.5)

				this.dom.hoverTip.clear().show(event.clientX, event.clientY)
				const table = table2col({ holder: this.dom.hoverTip.d.append('div').style('padding', '6px') })
				addTooltipRows(full, table, this.termType)
			})
			.on('mouseleave', () => {
				hoverLayer.selectAll('*').remove()
				this.dom.hoverTip.hide()
			})
			.on('click', (event: any) => {
				const rect = (cover.node() as HTMLElement).getBoundingClientRect()
				const mx = event.clientX - rect.left
				const my = event.clientY - rect.top
				const candidates = findPointsInRadius(qt, mx, my, hitRadius)
				if (candidates.length === 0) return
				candidates.sort((a, b) => a.distance - b.distance)
				const nearest = candidates[0].point
				const full = this.resolvePoint(nearest)
				if (!full) return

				this.dom.hoverTip.hide()
				this.dom.clickTip.clear().show(event.clientX, event.clientY)
				clickMenuOpen = true

				const body = this.dom.clickTip.d.append('div').style('padding', '6px')
				const table = table2col({ holder: body.append('div') })
				addTooltipRows(full, table, this.termType)
				const menuDiv = body.append('div').style('padding', '5px')
				addClickMenuActions(full, menuDiv, this.dom.clickTip, this.interactions, this.termType)
			})
	}

	/** Look up the full DataPointEntry for an interactive point returned by the server. */
	private resolvePoint(p: VolcanoInteractivePoint): DataPointEntry | undefined {
		const key = this.termType === DNA_METHYLATION ? p.promoter_id || p.gene : p.gene
		return key ? this.pointByKey.get(key) : undefined
	}

	renderTermInfo(plotDim) {
		if (this.viewData.termInfo == undefined) return
		this.volcanoDom.top.attr('transform', `translate(${plotDim.top.x}, ${plotDim.top.y})`)

		const y = this.viewData.termInfo.y
		const addLabel = term => {
			return this.volcanoDom.top
				.append('text')
				.attr('font-size', '0.9em')
				.attr('transform', `translate(${term.x}, ${y + 10})`)
				.text(term.label)
		}

		const firstTerm = this.viewData.termInfo.first
		addLabel(firstTerm)

		const secondTerm = this.viewData.termInfo.second
		const secondLabel = addLabel(secondTerm)
		secondLabel.attr('text-anchor', 'end')
	}

	renderScale(scale: any, isLeft = false) {
		const scaleG = this.volcanoDom[isLeft ? 'yAxis' : 'xAxis']
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}

	renderFoldChangeLine(plotDim: VolcanoPlotDimensions) {
		// x=0 in data space, converted to SVG coords via the new xScale.
		const zeroX = plotDim.plot.x + plotDim.xScale.scale(0)
		this.volcanoDom.plot
			.append('line')
			.attr('stroke', '#ccc')
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', zeroX)
			.attr('x2', zeroX)
			.attr('y1', plotDim.plot.y)
			.attr('y2', plotDim.plot.y + plotDim.plot.height)
	}

	renderStatsMenu() {
		for (const img of this.viewData.images || []) {
			this.dom.actionsTip.d
				.append('img')
				.style('display', 'inline-block')
				.style('margin-left', '10px')
				.style('margin-top', '-30px')
				.attr('width', 450)
				.attr('height', 450)
				.attr('src', img.src)
		}
		const tableHolder = this.dom.actionsTip.d
			.append('div')
			.style('display', this.viewData.images.length == 1 ? 'inline-block' : 'block')
			.style('margin', `${this.viewData.images.length == 1 ? `40px 10px` : `0px 0px`} 0px 5px`)
			.style('vertical-align', 'top')
		const table = table2col({ holder: tableHolder })
		for (const d of this.viewData.statsData) {
			const [td1, td2] = table.addRow()
			td1.text(d.label)
			td2.style('text-align', 'end').text(d.value)
		}
	}

	renderPValueTable() {
		// Cap rendered rows to prevent browser OOM with large datasets.
		const maxTableRows = 5000
		const allRows = this.viewData.pValueTableData.rows
		const rows = allRows.length > maxTableRows ? allRows.slice(0, maxTableRows) : allRows
		if (allRows.length > maxTableRows) {
			this.volcanoDom.pValueTable
				.append('div')
				.style('padding', '5px 10px')
				.style('font-size', '.8em')
				.style('color', '#666')
				.text(
					`Showing top ${maxTableRows.toLocaleString()} of ${allRows.length.toLocaleString()} significant results (sorted by fold-change)`
				)
		}
		renderTable({
			columns: this.viewData.pValueTableData.columns,
			rows,
			div: this.volcanoDom.pValueTable,
			showLines: true,
			maxHeight: `${this.viewData.pValueTableData.height}px`,
			resize: true,
			header: { allowSort: true },
			noRadioBtn: true,
			noButtonCallback: (i: number) => {
				const gene = this.viewData.pValueTableData.rows[i][0].value as string
				if (!gene) return
				this.interactions.highlightDataPoint(gene)
			},
			hoverEffects: (tr: any, row: any) => {
				// Sync table-row hover with the volcano: draw a temporary
				// highlight on the hover layer at the matching point's
				// position (computed from the point's data via the current
				// axis scales, so it works for any point not just top-N).
				// row[0].value is the first data cell: gene_name or promoter_id.
				const key = row?.[0]?.value as string
				if (!key) return
				const point = this.pointByKey.get(key)
				if (!point) return
				tr.on('mouseover', () => this.drawTableHoverHighlight(point))
				tr.on('mouseleave', () => this.hoverLayer?.selectAll('.table-hover-highlight').remove())
			}
		})
	}

	/** Draw persistent highlight circles for every point in
	 *  config.highlightedData. Called once per render; the highlight list is
	 *  maintained via plot_edit dispatches from interactions.highlightDataPoint. */
	private renderPersistentHighlights() {
		if (!this.pngLayout) return
		const layer = this.volcanoDom.plot.append('g').attr('id', 'sjpp-volcano-highlight-layer')
		const highlighted = this.viewData.pointData.filter(d => (d as any).highlighted)
		for (const point of highlighted) {
			const coords = this.computePointSvgCoords(point)
			if (!coords) continue
			layer
				.append('circle')
				.attr('cx', coords.cx)
				.attr('cy', coords.cy)
				.attr('r', this.pngLayout.dotRadius + 2)
				.attr('fill', this.settings.defaultHighlightColor || '#ffa200')
				.attr('fill-opacity', 0.9)
				.attr('stroke', point.color || 'black')
				.attr('stroke-width', 1.5)
		}
	}

	/** Compute SVG coordinates for a data point using the current axis scales. */
	private computePointSvgCoords(point: DataPointEntry): { cx: number; cy: number } | undefined {
		if (!this.pngLayout) return
		const fc = point.fold_change
		const pvKey = `${this.settings.pValueType}_p_value` as keyof DataPointEntry
		const pv = Number(point[pvKey])
		const negLog10P = pv <= 0 ? this.plotData.y_max : -Math.log10(pv)
		const xScale = this.viewData.plotDim.xScale.scale
		const yScale = this.viewData.plotDim.yScale.scale
		// xScale/yScale ranges cover the plot rect (not the PNG's padded area),
		// so offset by plot.x / plot.y to get SVG coords.
		const plot = this.viewData.plotDim.plot
		return {
			cx: plot.x + xScale(fc),
			cy: plot.y + yScale(negLog10P)
		}
	}

	/** Draw a highlight at the given data point's position, used when the
	 *  p-value table row is hovered. */
	private drawTableHoverHighlight(point: DataPointEntry) {
		if (!this.hoverLayer || !this.pngLayout) return
		const coords = this.computePointSvgCoords(point)
		if (!coords) return
		this.hoverLayer.selectAll('.table-hover-highlight').remove()
		this.hoverLayer
			.append('circle')
			.attr('class', 'table-hover-highlight')
			.attr('cx', coords.cx)
			.attr('cy', coords.cy)
			.attr('r', this.pngLayout.dotRadius + 2)
			.attr('fill', this.settings.defaultHighlightColor || '#ffa200')
			.attr('fill-opacity', 0.9)
			.attr('stroke', point.color || 'black')
			.attr('stroke-width', 1.5)
	}

	setSvgSubscriptLabel(textElem: any, prefix: string, subscript: string, suffix: string) {
		textElem.text(null)
		textElem.append('tspan').text(prefix)
		textElem.append('tspan').attr('baseline-shift', 'sub').attr('font-size', '0.7em').text(subscript)
		textElem.append('tspan').text(suffix)
	}
}

// `select` kept for possible future use (e.g. hooking up pValueTable hover).
void select
