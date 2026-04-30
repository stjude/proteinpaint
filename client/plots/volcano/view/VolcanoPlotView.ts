import { axisBottom, axisLeft } from 'd3-axis'
import { axisstyle, Menu, table2col, renderTable } from '#dom'
import { selectAll } from 'd3-selection'
import { rgb } from 'd3-color'
import { quadtree } from 'd3-quadtree'
import { roundValueAuto } from '#shared/roundValue.js'
import type { DataPointEntry, VolcanoDom, VolcanoPlotDimensions, VolcanoViewData } from '../VolcanoTypes'
import type { VolcanoPlotDom } from './VolcanoPlotDom'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { addTooltipRows, getActionMenuOpts } from './DataPointMouseEvents'
import { findPointsInRadius } from '../../shared/quadtreeHitTest'
import { showResultsTable } from '../../shared/resultsTable'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import type { ValidatedVolcanoSettings } from '../settings/Settings'

export class VolcanoPlotView {
	dom: VolcanoDom
	interactions: VolcanoInteractions
	settings: any
	termType: string
	volcanoDom: VolcanoPlotDom
	viewData!: VolcanoViewData

	constructor(dom: VolcanoDom, interactions: VolcanoInteractions, termType: string) {
		this.dom = dom
		this.interactions = interactions
		this.termType = termType
		const actions = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-actions')
			.style('display', 'block')
			.style('z-index', 1)
			.style('position', 'relative')
		const svg = this.dom.holder
			.append('svg')
			.style('display', 'inline-block')
			.attr('id', 'sjpp-volcano-svg')
			.style('vertical-align', 'top')
		this.volcanoDom = {
			actions,
			svg,
			pValueTable: undefined,
			top: undefined,
			xAxis: undefined,
			xAxisLabel: undefined,
			yAxis: undefined,
			yAxisLabel: undefined,
			plot: undefined
		} as Partial<VolcanoPlotDom> as VolcanoPlotDom
	}

	render(settings: ValidatedVolcanoSettings, viewData: VolcanoViewData) {
		this.settings = settings
		this.viewData = viewData
		const plotDim = this.viewData.plotDim

		this.initDom()

		this.renderUserActions()
		this.renderPlot(plotDim)
		renderDataPoints(this)
		this.renderFoldChangeLine(plotDim)
		this.setupOverlayInteractions(plotDim)
		if (this.settings.showPValueTable) this.renderPValueTable()
	}

	initDom() {
		this.volcanoDom.actions.selectAll('*').remove()
		this.volcanoDom.svg.selectAll('*').remove()

		const svg = this.volcanoDom.svg
		this.volcanoDom.top = svg.append('g').attr('id', 'sjpp-volcano-top')
		this.volcanoDom.xAxis = svg.append('g').attr('id', 'sjpp-volcano-xAxis')
		this.volcanoDom.yAxis = svg.append('g').attr('id', 'sjpp-volcano-yAxis')
		this.volcanoDom.xAxisLabel = svg.append('text').attr('id', 'sjpp-volcano-xAxisLabel').attr('text-anchor', 'middle')
		this.volcanoDom.yAxisLabel = svg.append('text').attr('id', 'sjpp-volcano-yAxisLabel').attr('text-anchor', 'middle')
		this.volcanoDom.plot = svg.append('g').attr('id', 'sjpp-volcano-plot')

		if (!this.settings.showPValueTable) return
		this.volcanoDom.pValueTable = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-pValueTable')
			.attr('data-testid', 'sjpp-volcano-pValueTable')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
	}

	renderUserActions() {
		//Images may have a large margin. Hide the overflow.
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

			this.addActionButton('Show p-value table', [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], async () => {
				/** TODO: This is very slow to render. Need to optimize rendering
				 * and server response to increase performance.*/
				const showTable = !this.settings.showPValueTable
				await this.interactions.app.dispatch({
					type: 'plot_edit',
					id: this.interactions.id,
					config: { settings: { volcano: { showPValueTable: showTable } } }
				})
			})
		}
		if (numSigGenes && numSigGenes >= 3) {
			// Launch hierCluster for DEGs between the two groups
			this.addActionButton(
				`Hierarchical clustering of ${numSigGenes > 100 ? 'top 100' : numSigGenes} DE genes`,
				[GENE_EXPRESSION],
				async () => {
					await this.interactions.launchDEGClustering()
				}
			)
		}
	}

	/** Use the termTypes arr to render the buttons in a consistent order */
	addActionButton(text: string, termTypes: string[], callback: any) {
		if (this.viewData.userActions.noShow.has(text)) return
		if (!termTypes.includes(this.termType)) return
		const button = this.volcanoDom.actions
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('margin', '3px')
			.style('padding', '3px')
			.text(text)
			.on('click', async () => {
				this.dom.actionsTip.clear().showunder(button.node())
				await callback()
			})
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

		this.renderScale(plotDim.xScale)
		this.renderScale(plotDim.yScale, true)

		// Server-rendered PNG of the full scatter (every dot, non-interactive).
		// Drawn first so overlay circles + the border rect sit on top. The volcano
		// binary emits a borderless image whose data extent matches the client's
		// scales, so placing it over the plot rect aligns dot-for-dot.
		if (this.viewData.volcanoPng) {
			this.volcanoDom.plot
				.append('image')
				.attr('href', `data:image/png;base64,${this.viewData.volcanoPng}`)
				.attr('x', plotDim.plot.x)
				.attr('y', plotDim.plot.y)
				.attr('width', plotDim.plot.width)
				.attr('height', plotDim.plot.height)
				.attr('preserveAspectRatio', 'none')
		}
	}

	renderTermInfo(plotDim) {
		if (this.viewData.termInfo == undefined) return
		this.volcanoDom.top.attr('transform', `translate(${plotDim.top.x}, ${plotDim.top.y})`)

		const y = this.viewData.termInfo.y
		const addLabel = term => {
			return (
				this.volcanoDom.top
					.append('text')
					.attr('font-size', '0.9em')
					.attr('transform', `translate(${term.x}, ${y + 10})`)
					// .attr('text-anchor', 'start')
					.text(term.label)
			)
		}

		// const addRect = (term) => {
		// 	this.volcanoDom.top.append('rect')
		// 		.attr('width', 10)
		// 		.attr('height', 10)
		// 		.attr('transform', `translate(${term.rectX}, ${y})`)
		// 		.attr('fill', term.color)
		// }

		const firstTerm = this.viewData.termInfo.first
		addLabel(firstTerm)
		// addRect(firstTerm)

		const secondTerm = this.viewData.termInfo.second
		// addRect(secondTerm)
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
		//logFoldChangeLine
		this.volcanoDom.plot
			.append('line')
			.attr('stroke', '#ccc')
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', plotDim.logFoldChangeLine.x)
			.attr('x2', plotDim.logFoldChangeLine.x)
			.attr('y1', plotDim.logFoldChangeLine.y1)
			.attr('y2', plotDim.logFoldChangeLine.y2)
	}

	/** Quadtree-driven hover & click overlay. Mirrors the manhattan plot:
	 *   - a transparent SVG rect (cover) sits over the plot rect and absorbs
	 *     mouse events so coincident dots are all reachable;
	 *   - hover finds every point within (dotRadiusPx + 3) px and shows a
	 *     single-gene table2col tooltip OR a multi-gene sortable table;
	 *   - click launches the per-gene action menu directly for one hit, or
	 *     opens a click-menu with a row-clickable table for many hits. */
	setupOverlayInteractions(plotDim: VolcanoPlotDimensions) {
		// Skip for term types with no data point actions (e.g. SCCT) — preserves
		// existing behavior where SCCT volcanoes have no per-dot interactions.
		if (this.termType === SINGLECELL_CELLTYPE) return

		const points = this.viewData.pointData as DataPointEntry[]
		if (!points || points.length === 0) return

		// PNG-aligned radius for hover fills + hit-radius. The SVG overlay rings
		// (points[0].radius) are deliberately drawn smaller to keep their outer
		// stroke from overhanging the PNG dot.
		const dotRadiusPx = this.viewData.plotExtent.dotRadiusPx
		const hitRadius = dotRadiusPx + 3
		const maxTooltipGenes = this.settings.maxTooltipGenes

		// Hover-ring layer — visual only, never intercepts mouse events so the
		// cover keeps absorbing them.
		const hoverLayer = this.volcanoDom.plot.append('g').attr('id', 'sjpp-volcano-hover').style('pointer-events', 'none')

		// Cover rect — last child of plot group so it sits on top of dots,
		// hover rings, and the fold-change line.
		const cover = this.volcanoDom.plot
			.append('rect')
			.attr('id', 'sjpp-volcano-cover')
			.attr('x', plotDim.plot.x)
			.attr('y', plotDim.plot.y)
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('fill', 'transparent')
			.style('pointer-events', 'all')
			.style('cursor', 'default')

		// Quadtree in cover-local space — d.x/d.y are SVG-absolute, so subtract
		// the plot rect's origin once when building the tree.
		const qt = quadtree<DataPointEntry>()
			.x(d => d.x - plotDim.plot.x)
			.y(d => d.y - plotDim.plot.y)
			.addAll(points)

		const hoverTip = this.dom.tip
		const clickMenu = new Menu({
			padding: '',
			onHide: () => {
				clickMenuIsShown = false
				// Drop the persisted highlight once the user dismisses the menu.
				drawHoverRings([])
			}
		})
		let clickMenuIsShown = false

		const highlightColor = this.settings.defaultHighlightColor
		// Inset by stroke-width/2 (= 0.5 px for stroke=1) so the orange fill
		// stops at the ring's inner edge — the colored stroke stays fully
		// visible around the highlight instead of being painted over.
		const highlightRadius = Math.max(0.5, dotRadiusPx - 0.5)
		const drawHoverRings = (dots: DataPointEntry[]) => {
			hoverLayer.selectAll('circle').remove()
			for (const d of dots) {
				hoverLayer
					.append('circle')
					.attr('cx', d.x)
					.attr('cy', d.y)
					.attr('r', highlightRadius)
					.attr('fill', highlightColor)
					.attr('fill-opacity', 0.9)
			}
		}

		const findCandidates = (event: MouseEvent) => {
			const rect = (cover.node() as SVGRectElement).getBoundingClientRect()
			const mx = event.clientX - rect.left
			const my = event.clientY - rect.top
			const candidates = findPointsInRadius<DataPointEntry>(
				qt,
				mx,
				my,
				hitRadius,
				d => d.x - plotDim.plot.x,
				d => d.y - plotDim.plot.y
			)
			candidates.sort((a, b) => a.distance - b.distance)
			return candidates.map(c => c.point)
		}

		cover.on('mousemove', (event: MouseEvent) => {
			if (clickMenuIsShown) return
			const all = findCandidates(event)
			const shown = all.slice(0, maxTooltipGenes)
			const additionalCount = all.length - maxTooltipGenes

			if (shown.length === 0) {
				drawHoverRings([])
				hoverTip.hide()
				return
			}

			drawHoverRings(shown)
			hoverTip.clear().show(event.clientX, event.clientY)

			if (shown.length === 1) {
				const table = table2col({ holder: hoverTip.d.append('table') })
				addTooltipRows(shown[0], table, this.termType)
			} else {
				const holder = hoverTip.d.append('div').style('margin', '10px')
				renderVolcanoGeneTable(holder, shown, this.termType, this.settings.pValueType)
				if (additionalCount > 0) {
					holder
						.append('div')
						.style('font-size', '0.85em')
						.style('color', '#666')
						.style('font-style', 'italic')
						.text(`and ${additionalCount} more gene${additionalCount > 1 ? 's' : ''}...`)
				}
			}
		})

		cover.on('mouseleave', () => {
			// Don't clear rings while the click menu is showing — the highlight
			// must stay on the picked dots until the user dismisses the menu.
			if (!clickMenuIsShown) drawHoverRings([])
			hoverTip.hide()
		})

		cover.on('click', (event: MouseEvent) => {
			const candidates = findCandidates(event)
			if (candidates.length === 0) return
			hoverTip.hide()
			// Persist highlight on the picked dots — clickMenu.onHide clears it.
			drawHoverRings(candidates)
			clickMenuIsShown = true

			if (candidates.length === 1) {
				// Use clickMenu (not hoverTip) so the cover's mouseleave handler
				// doesn't dismiss this menu when the cursor moves up to a button.
				openActionMenu(candidates[0], event, clickMenu, this.termType, this.interactions)
				return
			}

			clickMenu.clear().show(event.clientX, event.clientY)
			const holder = clickMenu.d.append('div').style('margin', '10px')
			renderVolcanoGeneTable(holder, candidates, this.termType, this.settings.pValueType, {
				// Radio buttons (not checkboxes) — volcano actions only target one gene.
				singleMode: true,
				noButtonCallback: (i: number) => {
					const d = candidates[i]
					openActionMenu(d, event, clickMenu, this.termType, this.interactions)
				}
			})
		})
	}

	renderStatsMenu() {
		//Render any images. viewModel returns the response array of images or []
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
			//Show the stats table underneath the images if > 1 image or to the right if only 1 image
			.style('display', this.viewData.images.length == 1 ? 'inline-block' : 'block')
			//Top margin is roughly inline with image however the margins are set by server
			//Likewise the image margins are undetectable.
			//This is a roughly satistifes the different image margin scenarios.
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
		if (!this.settings.showPValueTable) return
		// Cap rendered rows to prevent browser OOM with large datasets (e.g. 30k+ significant promoters).
		// The full data is still available in pValueTableData.rows for export/search.
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
				//On click, persistently highlight the data point
				// if (this.termType != GENE_EXPRESSION) return
				const gene = this.viewData.pValueTableData.rows[i][0].value as string
				if (!gene) return
				this.interactions.highlightDataPoint(gene)
			},
			hoverEffects: (tr, row) => {
				//May restrict termTypes later
				// if (this.termType != GENE_EXPRESSION) return
				//Highlight the data point when hovering over the table row
				//Previously highlighted data points are not affected
				const circles = this.volcanoDom.plot.selectAll('circle').nodes()
				const dataKey = this.termType === DNA_METHYLATION ? 'promoter_id' : 'gene_name'
				const circle = circles.find((d: any) => d.__data__[dataKey] == row[0].value) as any
				if (!circle || circle.__data__.highlighted) return

				/** Circles may render behind several other circles, making it hard
				 * to see the highlight. Clone the circle to appear on top of the
				 * elements, then destroy. */
				let clone
				tr.on('mouseover', () => {
					if (circle.__data__.highlighted || clone) return
					clone = this.volcanoDom.plot.node()?.appendChild(circle.cloneNode(true))
					clone.setAttribute('fill-opacity', 0.9)
				})
				tr.on('mouseleave', () => {
					if (!clone) return
					clone.remove()
					clone = null
				})
				//All other circles appear dimmed on hover
				this.volcanoDom.pValueTable.on('mouseover', () => {
					selectAll(circles).attr('stroke-opacity', 0.075)
				})
				this.volcanoDom.pValueTable.on('mouseleave', () => {
					selectAll(circles).attr('stroke-opacity', (d: any) => (d.significant ? 0.35 : 0.2))
				})
			}
		})
	}

	setSvgSubscriptLabel(textElem: any, prefix: string, subscript: string, suffix: string) {
		textElem.text(null)
		textElem.append('tspan').text(prefix)
		textElem.append('tspan').attr('baseline-shift', 'sub').attr('font-size', '0.7em').text(subscript)
		textElem.append('tspan').text(suffix)
	}
}

function renderDataPoints(self: any) {
	// Visual-only circles. The cover rect added in setupOverlayInteractions
	// drives all hover/click — we strip pointer-events here so events fall
	// through to the cover. The p-value table hover-clone effect at
	// renderPValueTable() still finds these via selectAll('circle').
	self.volcanoDom.plot
		.selectAll('circle')
		.data(self.viewData.pointData)
		.enter()
		.append('circle')
		.attr('stroke', (d: DataPointEntry) => rgb(d.color).formatHex())
		.attr('stroke-opacity', (d: DataPointEntry) => (d.significant ? 0.35 : 0.2))
		// Match the rust PNG's stroke-width (1) so the overlay ring sits
		// exactly on top of the rasterized dot.
		.attr('stroke-width', 1)
		.attr('fill', self.settings.defaultHighlightColor)
		.attr('fill-opacity', (d: DataPointEntry) => (d.highlighted ? 0.9 : 0))
		.attr('cx', (d: DataPointEntry) => d.x)
		.attr('cy', (d: DataPointEntry) => d.y)
		.attr('r', (d: DataPointEntry) => d.radius)
		.style('pointer-events', 'none')
}

/** Renders the multi-gene table used by both the hover tooltip (when >1 dot
 * is in range) and the click menu. Reuses showResultsTable for sortable
 * columns; volcano omits the `app` arg so manhattan-only Lollipop/Matrix
 * buttons stay hidden. The p-value column matches `settings.pValueType` so
 * the table aligns with the y-axis basis (original vs adjusted). */
function renderVolcanoGeneTable(
	holder: any,
	dots: DataPointEntry[],
	termType: string,
	pValueType: 'original' | 'adjusted',
	extra: Record<string, any> = {}
) {
	const isDM = termType === DNA_METHYLATION
	const pLabel = `${pValueType.charAt(0).toUpperCase()}${pValueType.slice(1)} p-value`
	const pField = `${pValueType}_p_value` as 'original_p_value' | 'adjusted_p_value'
	const columns = isDM
		? [
				{ label: 'Promoter' },
				{ label: 'Gene(s)' },
				{ label: 'log₂(FC)', sortable: true },
				{ label: pLabel, sortable: true }
		  ]
		: [{ label: 'Gene' }, { label: 'log₂(FC)', sortable: true }, { label: pLabel, sortable: true }]
	const rows = dots.map(d => {
		const fc = { value: roundValueAuto(d.fold_change) }
		const pval = { value: roundValueAuto(d[pField]) }
		if (isDM) {
			return [{ value: (d as any).promoter_id || '' }, { value: d.gene_name || '' }, fc, pval]
		}
		return [{ value: d.gene_name || '' }, fc, pval]
	})
	showResultsTable({
		tableDiv: holder,
		dataItems: dots,
		getGene: (d: any) => d.gene_name,
		columns,
		rows,
		...extra
	} as any)
}

/** Opens the per-gene action menu at the click point. Action buttons sit at
 * the top of the menu; the same single-gene info shown on hover (gene name,
 * fold-change, p-values) is rendered below so the user can confirm what
 * they're acting on. Used for both the single-hit click flow and the
 * row-drill-down from the multi-hit click menu. */
function openActionMenu(
	d: DataPointEntry,
	event: MouseEvent,
	hostMenu: any,
	termType: string,
	interactions: VolcanoInteractions
) {
	const opts = getActionMenuOpts(d, termType, interactions)
	hostMenu.clear().show(event.clientX, event.clientY)
	const container = hostMenu.d.append('div').style('margin', '10px')

	if (opts.length > 0) {
		const buttonRow = container.append('div').style('margin-bottom', '10px')
		for (const opt of opts) {
			buttonRow
				.append('button')
				.attr('class', 'sja_menuoption')
				.style('margin-right', '5px')
				.text(opt.label)
				.on('click', async () => {
					hostMenu.hide()
					await opt.onClick()
				})
		}
	}

	const table = table2col({ holder: container.append('table') })
	addTooltipRows(d, table, termType)
}
