import { axisstyle, table2col, renderTable, DataPointInteractions, type ActionMenuItem } from '#dom'
import { axisBottom, axisLeft, rgb, select, selectAll } from 'd3'
import type { DataPointEntry, VolcanoDom, VolcanoPlotDimensions, VolcanoViewData } from '../VolcanoTypes'
import type { VolcanoPlotDom } from './VolcanoPlotDom'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { roundValueAuto } from '#shared/roundValue.js'
import type { ValidatedVolcanoSettings } from '../settings/Settings'
import {
	getPlottedEffect,
	getVolcanoHandler,
	type SharedTooltipRows,
	type TooltipRow,
	type VolcanoAction,
	type VolcanoHandler
} from '../handlers'

export class VolcanoPlotView {
	dom: VolcanoDom
	interactions: VolcanoInteractions
	settings: any
	termType: string
	volcanoDom: VolcanoPlotDom
	viewData!: VolcanoViewData
	/** volcano and, for a DMR scan, the isoform starburst side by side; the p-value table follows them */
	row: any
	/** the holder of the starburst embedded beside a DMR scan's volcano, see Volcano.ts */
	starburstDiv: any

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
		this.row = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-row')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('gap', '20px')
			.style('align-items', 'flex-start')
		const svg = this.row.append('svg').style('display', 'block').attr('id', 'sjpp-volcano-svg')
		// before the p-value table, which each render appends; hidden, so that the row's gap is not spent on it, until the
		// starburst shows itself there
		this.starburstDiv = this.row
			.append('div')
			.attr('data-testid', 'sjpp-volcano-starburst')
			.property('hidden', true)
			/* as wide as its plots: its caption and controls wrap under them instead of pushing it below the volcano. The
			plot holder sets nowrap, which would make min-content the caption's whole line */
			.style('inline-size', 'min-content')
			.style('white-space', 'normal')
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

	/** looked up on use, not in the constructor: a volcano of an unsupported type is still created,
	 * and fails when it asks for data */
	get handler(): VolcanoHandler {
		return getVolcanoHandler(this.termType)
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
		this.attachInteractions(plotDim)
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

		// Always clear the previous p-value table div before deciding whether
		// to recreate it. Without this, toggling showPValueTable off leaves
		// the old div in dom.holder (the table never closes), and toggling
		// it on repeatedly appends additional divs.
		this.dom.holder.select('#sjpp-volcano-pValueTable').remove()

		if (!this.settings.showPValueTable) return
		this.volcanoDom.pValueTable = this.row
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
		this.addActionButton('Confounding factors', 'confounders', () => this.interactions.confoundersMenu())
		this.addActionButton('Highlight genes', 'highlight', () => this.interactions.launchGeneSetEdit())
		this.addActionButton(
			'Statistics',
			'statistics',
			() => {
				this.renderStatsMenu()
			},
			{ whenOpen: 'Hide statistics' }
		)
		// every transcript's promoter and body methylation change against its expression change, for these groups;
		// only where the dataset has transcript counts. A DMR scan opens it beside the volcano (Volcano.ts), on click
		// because a first run takes minutes; any other element type opens it as a plot of its own
		if (hasIsoformStarburst(this.interactions.app.vocabApi.termdbConfig)) {
			const label = 'Methylation vs expression by isoform'
			if (!this.viewData.scan) this.addActionButton(label, 'starburst', () => this.interactions.launchStarburst())
			else {
				/* A toggle, as the p-value table's button. The open state is the starburst's own setting, which the
				volcano's state leaves out so that opening it does not re-run the volcano: read from the app state here,
				and the button relabeled on click, since the volcano does not redraw for it. */
				const isOpen = () =>
					!!this.interactions.app.getState().plots.find((p: any) => p.id == this.interactions.id)?.settings
						?.methylationStarburst?.open
				const text = (open: boolean) => (open ? `Hide ${label.toLowerCase()}` : label)
				this.addActionButton(text(isOpen()), 'starburst', async (button: any) => {
					// nothing to show in the action menu that every button opens
					this.dom.actionsTip.hide()
					const open = !isOpen()
					button.text(text(open))
					await this.interactions.openEmbeddedStarburst(open)
				})
			}
		}
		/* The view model builds exactly one "Number of significant <noun>" row, the noun following the
		term type. Matching a hardcoded "genes" missed proteomics ("proteins") entirely, so its caption
		and direction split never rendered. */
		const SIG_PREFIX = 'Number of significant '
		const sigRow = this.viewData.statsData.find(d => d.label.startsWith(SIG_PREFIX))
		// stats values may be formatted strings now (scan rows); the count row is always a number
		const numSigGenes = Number(sigRow?.value ?? 0)
		if (numSigGenes) {
			// grouped: these run to five and six figures, and "84302" vs "8430" is hard to tell apart at a glance
			const n = numSigGenes.toLocaleString()
			/* Direction split next to the total. Both counts are the server's, taken over every
			significant row rather than the maxInteractiveDots-capped dots list -- the strongest
			hits are not direction-balanced, so counting what reached the browser would misreport
			the ratio. Named for the CASE group, matching the x-axis subtraction order, so the
			label reads the same way round as the plot. */
			const up = this.viewData.numSignificantUp
			const down = this.viewData.numSignificantDown
			const words = this.handler.directions || { up: 'up', down: 'down' }
			const split =
				up + down > 0 ? ` (${up.toLocaleString()} ${words.up} / ${down.toLocaleString()} ${words.down})` : ''
			/* Name the centring in the caption, with the offset it removed. Both counts are then
			self-describing wherever the line is read or screenshotted, and the raw and centred
			numbers cannot be confused for each other. */
			const off = this.viewData.xOffset
			const centered = this.viewData.centered ? `, centered on median Δβ ${off > 0 ? '+' : ''}${off.toFixed(3)}` : ''
			// the data type may name the count, as "DE genes"; otherwise it is named for what the stats row counted
			const noun =
				this.handler.getSignificantNoun?.(this.settings, this.viewData.scan) ??
				`significant ${sigRow!.label.slice(SIG_PREFIX.length)}`
			const sigText = `${n} ${noun}` + split + centered + ':'
			this.volcanoDom.actions.append('span').text(sigText).style('margin-left', '10px').style('font-weight', 'bold')

			const pValueTableButtonText = this.settings.showPValueTable ? 'Hide p-value table' : 'Show p-value table'
			this.addActionButton(pValueTableButtonText, 'pValueTable', async () => {
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
		const termdbConfig = this.interactions.app.vocabApi.termdbConfig
		if (numSigGenes && numSigGenes >= 3 && (this.handler.clusterTerms?.isAvailable?.(termdbConfig) ?? true)) {
			// Launch hierCluster for the significant rows between the two groups
			const noun = this.handler.getSignificantNoun?.(this.settings, this.viewData.scan) ?? 'DE genes'
			this.addActionButton(
				`Hierarchical clustering of ${numSigGenes > 100 ? 'top 100' : numSigGenes} ${noun}`,
				'clustering',
				async () => {
					await this.interactions.launchDEGClustering()
				}
			)
		}
	}

	/** Renders the button of an action that the handler of the data type offers and this run does not
	 * hide. The buttons keep the order of the calls in renderUserActions().
	 *
	 * Pass `opts.whenOpen` to make the button a toggle: clicking once opens
	 * the actionsTip with the callback's content and swaps the button text
	 * to `whenOpen` ("Hide statistics", etc.); clicking again hides the tip
	 * and restores the original text. The text also restores when the tip
	 * closes via Esc or outside-click (Menu.onHide hook), and when another
	 * action button hijacks the tip (the loop below resets all toggles
	 * before showing the new content). */
	addActionButton(text: string, action: VolcanoAction, callback: any, opts?: { whenOpen?: string }) {
		if (this.viewData.userActions.noShow.has(action)) return
		if (!this.handler.actions.includes(action)) return
		const button = this.volcanoDom.actions
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('margin', '3px')
			.style('padding', '3px')
			.text(text)
			.on('click', async () => {
				const whenOpen = opts?.whenOpen
				if (whenOpen && button.text() === whenOpen) {
					// Toggle close: tip is currently showing this button's
					// content. Hide it; onHide resets the label and untags
					// the button so the body's mousedown handler will treat
					// it as outside the tip again.
					this.dom.actionsTip.hide()
					return
				}
				// Reset any other toggle buttons whose tip content we're
				// about to overwrite. Tagging via data-attr keeps the state
				// on the DOM node so we don't need a class field.
				this.volcanoDom.actions.selectAll('button[data-volcano-toggle-open="1"]').each(function () {
					const b = select(this as HTMLButtonElement)
					const closed = b.attr('data-volcano-toggle-closed')
					if (closed) b.text(closed).attr('data-volcano-toggle-open', null)
					;(this as any).parent_menu = undefined
					const eh = (this as any).__volcanoEscHandler
					if (eh) {
						document.removeEventListener('keydown', eh)
						;(this as any).__volcanoEscHandler = undefined
					}
				})
				this.dom.actionsTip.clear().showunder(button.node())
				if (whenOpen) {
					button.text(whenOpen).attr('data-volcano-toggle-open', '1').attr('data-volcano-toggle-closed', text)
					// Tag the button as a "parent_menu" of the tip so Menu's
					// body-mousedown outside-click handler skips it (see
					// menu.js, body.on('mousedown.menu') — checks
					// event.target.parent_menu === this.dnode). Without this,
					// clicking the toggle button to close would fire the
					// body handler first → tip hides + onHide resets label →
					// the click handler then sees the closed label and
					// reopens, repainting instead of closing.
					;(button.node() as any).parent_menu = this.dom.actionsTip.dnode
					// Menu has a built-in keyup Escape handler on its own div,
					// but it only fires when the tip itself has keyboard
					// focus — typically lost the moment the user moves their
					// mouse over plot content. Attach a document-level
					// listener for the lifetime of the open toggle so Esc
					// closes from anywhere. Removed in both cleanup paths
					// (onHide below + the toggle-reset loop above).
					const escHandler = (e: KeyboardEvent) => {
						if (e.key === 'Escape') this.dom.actionsTip.hide()
					}
					document.addEventListener('keydown', escHandler)
					;(button.node() as any).__volcanoEscHandler = escHandler
					this.dom.actionsTip.onHide = () => {
						button.text(text).attr('data-volcano-toggle-open', null)
						;(button.node() as any).parent_menu = undefined
						document.removeEventListener('keydown', escHandler)
						;(button.node() as any).__volcanoEscHandler = undefined
					}
				} else {
					// Clear any stale onHide left by a previous toggle button
					// so an outside-click after this non-toggle open doesn't
					// reset the wrong button.
					this.dom.actionsTip.onHide = undefined
				}
				// the button, for a callback that relabels it
				await callback(button)
			})
	}

	renderPlot(plotDim: VolcanoPlotDimensions) {
		this.volcanoDom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.renderTermInfo(plotDim)

		this.volcanoDom.yAxisLabel.attr(
			'transform',
			`translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`
		)
		this.setSvgSubscriptLabel(this.volcanoDom.yAxisLabel, '-log', '10', `(${this.viewData.pValueLabel})`)

		this.volcanoDom.xAxisLabel.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
		const { field } = getPlottedEffect(this.handler, this.settings)
		if (field == 'delta_psi') {
			this.volcanoDom.xAxisLabel.selectAll('*').remove()
			this.volcanoDom.xAxisLabel.text(this.viewData.deltaPsiAxisLabel || 'ΔPSI (case − control)')
		} else if (field == 'delta_beta') {
			this.volcanoDom.xAxisLabel.selectAll('*').remove()
			/* Prefer the group-named form built by the view model ("Δβ (NSD2 Higher − NSD2 Lower)"):
			case/control are slot names, so the role-based wording does not say which direction a
			positive value points. Fall back to it only when the names are unavailable. */
			this.volcanoDom.xAxisLabel.text(this.viewData.deltaBetaAxisLabel || 'Δβ (case − control)')
		} else {
			this.volcanoDom.xAxisLabel.text(null)
			this.setSvgSubscriptLabel(this.volcanoDom.xAxisLabel, 'log', '2', '(fold-change)')
		}

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
			/* Group the counts, but only the counts: statsData also carries a percentage that the
			view model already put through roundValueAuto(), and toLocaleString() would re-round it
			to three decimals. Integer test rather than a per-label check so a row added later is
			formatted correctly without touching this. */
			td2.style('text-align', 'end').text(Number.isInteger(d.value) ? d.value.toLocaleString() : d.value)
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
				// Index into the same array handed to renderTable: it sorts rows in place, so
				// the unsliced pValueTableData.rows would be misindexed once a header is sorted.
				const key = this.viewData.pValueTableData.rowKeys.get(rows[i])
				if (!key) return
				this.interactions.highlightDataPoint(key)
			},
			hoverEffects: (tr, row) => {
				//May restrict termTypes later
				// if (this.termType != GENE_EXPRESSION) return
				//Highlight the data point when hovering over the table row
				//Previously highlighted data points are not affected
				const circles = this.volcanoDom.plot.selectAll('circle').nodes()
				const key = this.viewData.pValueTableData.rowKeys.get(row)
				const circle = circles.find((d: any) => this.handler.getRowKey(d.__data__) == key) as any
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

	private attachInteractions(plotDim: VolcanoPlotDimensions) {
		const points = this.viewData.pointData as DataPointEntry[]
		if (!points || points.length === 0) return

		const dotRadiusPx = this.viewData.plotExtent.dotRadiusPx
		const hitRadius = dotRadiusPx + 3
		// Inset by stroke-width/2 so the orange fill stops at the dot's stroke inner edge.
		const highlightRadius = Math.max(0.5, dotRadiusPx - 0.5)
		const highlightColor = this.settings.defaultHighlightColor

		// Hover-ring layer — visual only, never intercepts mouse events.
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

		// Circle as an SVG path so it can flow through the generic
		// `drawHoverShapes` helper (which renders `<path>` elements).
		const circlePath = (r: number) => `M${r},0 A${r},${r} 0 1,1 ${-r},0 A${r},${r} 0 1,1 ${r},0 Z`

		new DataPointInteractions<DataPointEntry>({
			cover,
			hoverLayer,
			hoverTip: this.dom.tip,
			points,
			// Quadtree in cover-local space — d.x/d.y are SVG-absolute, so subtract
			// the plot rect's origin once when building the tree.
			getX: d => d.x - plotDim.plot.x,
			getY: d => d.y - plotDim.plot.y,
			hitRadius,
			toHoverSpec: d => ({
				path: circlePath(highlightRadius),
				// Hover layer lives in the same coord space as the dots (SVG-absolute),
				// so translate by d.x/d.y — NOT the cover-local pair.
				transform: `translate(${d.x},${d.y})`,
				fill: highlightColor,
				fillOpacity: 0.9,
				stroke: 'none'
			}),
			maxTooltipRows: this.settings.maxTooltipGenes,
			itemNoun: 'gene',
			renderSingleHoverTooltip: (d, container) => {
				const table = table2col({ holder: container.append('table') })
				this.addTooltipRows(d, table)
			},
			buildMultiHitTableData: dots => this.buildMultiHitTable(dots),
			getActions: d => this.getActionMenuOpts(d),
			renderSingleHitInfo: (d, container) => {
				const tbl = table2col({ holder: container.append('table') })
				this.addTooltipRows(d, tbl)
			},
			// a methylation hit is known by its element or region: it may name no gene, or share one with other hits
			getRowKey: d => this.handler.getRowKey(d)
		}).attach()
	}

	/** The hover table of several dots: the columns that name a row, the plotted effect size, and the
	 * p-value that the y axis plots */
	private buildMultiHitTable(dots: DataPointEntry[]): { columns: any[]; rows: any[] } {
		const idColumns = this.handler.getIdColumns(this.settings)
		// must match the column header, or the header names one number and the cell holds another
		const effect = getPlottedEffect(this.handler, this.settings)
		// a single p (DAP's FDR, a scan's p) lives in original_p_value whatever the p-value type says
		const { pValueLabel, singlePValue } = this.viewData
		const pLabel = pValueLabel.charAt(0).toUpperCase() + pValueLabel.slice(1)
		const pField = (singlePValue ? 'original_p_value' : `${this.settings.pValueType}_p_value`) as
			| 'original_p_value'
			| 'adjusted_p_value'
		const columns = [
			...idColumns.map(c => ({ label: c.short ?? c.label })),
			{ label: effect.short, sortable: true },
			{ label: pLabel, sortable: true }
		]
		const rows = dots.map(d => [
			...idColumns.map(c => ({ value: c.value(d) })),
			{ value: roundValueAuto(d[effect.field]) },
			{ value: roundValueAuto(d[pField]) }
		])
		return { columns, rows }
	}

	/** Per-data-point action menu items (Violin / DMR / Box-plot), from the handler of the data type.
	 * Used by both the single-gene click flow and the multi-gene click-menu rows so the launchers stay
	 * in lock-step. */
	private getActionMenuOpts(d: DataPointEntry): ActionMenuItem[] {
		const { app, id } = this.interactions
		const termdbConfig = app.vocabApi.termdbConfig
		return (
			this.handler.getRowActions?.(d, {
				interactions: this.interactions,
				config: app.getState?.().plots.find((p: any) => p.id === id),
				termdbConfig,
				queries: termdbConfig?.queries,
				scan: this.viewData.scan
			}) || []
		)
	}

	/** Populates a `table2col` instance with the tooltip of one dot: the rows of the data type, around
	 * the plotted effect size and the p-values that every data type shows */
	private addTooltipRows(d: DataPointEntry, table: any) {
		const effect = getPlottedEffect(this.handler, this.settings)
		const shared: SharedTooltipRows = {
			effect: [effect.tooltip, roundValueAuto(d[effect.field])],
			// DAP carries a single FDR, a scan a single p; both are stored in original_p_value
			pValues: this.viewData.singlePValue
				? [[this.viewData.pValueLabel, roundValueAuto(d.original_p_value)]]
				: [
						['Original p-value', roundValueAuto(d.original_p_value)],
						...(d.adjusted_p_value != undefined
							? [['Adjusted p-value', roundValueAuto(d.adjusted_p_value)] as TooltipRow]
							: [])
				  ]
		}
		const run = { settings: this.settings, scan: this.viewData.scan }
		for (const [label, value] of this.handler.getTooltipRows(d, run, shared)) addTooltipRow(table, label, value)
	}
}

function addTooltipRow(table: any, text: string, value: number | string) {
	const [td1, td2] = table.addRow()
	td1.html(text)
	td2.text(value)
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

/** the isoform starburst needs the dataset's transcript counts, and per-CpG methylation for its promoters and bodies */
export function hasIsoformStarburst(termdbConfig: any): boolean {
	return !!(
		termdbConfig?.queries?.isoformExpressionCount && termdbConfig?.queries?.dnaMethylation?.regionAnalysis == 'cpg'
	)
}
