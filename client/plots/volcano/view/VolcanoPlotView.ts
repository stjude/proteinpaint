import { axisstyle, table2col, renderTable, DataPointInteractions, type ActionMenuItem } from '#dom'
import { axisBottom, axisLeft, rgb, selectAll } from 'd3'
import type { DataPointEntry, VolcanoDom, VolcanoPlotDimensions, VolcanoViewData } from '../VolcanoTypes'
import type { VolcanoPlotDom } from './VolcanoPlotDom'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE, PROTEOME_DAP } from '#shared/terms.js'
import { roundValueAuto } from '#shared/roundValue.js'
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

			const pValueTableButtonText = this.settings.showPValueTable ? 'Hide p-value table' : 'Show p-value table'
			this.addActionButton(pValueTableButtonText, [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], async () => {
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

	private attachInteractions(plotDim: VolcanoPlotDimensions) {
		// SCCT volcanoes have no per-dot interactions — preserve that by no-op'ing.
		if (this.termType === SINGLECELL_CELLTYPE) return

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
			getRowKey: d => d.gene_name
		}).attach()
	}

	private buildMultiHitTable(dots: DataPointEntry[]): { columns: any[]; rows: any[] } {
		const isDM = this.termType === DNA_METHYLATION
		const isDAP = this.termType === PROTEOME_DAP
		const pValueType = this.settings.pValueType
		const pLabel = `${pValueType.charAt(0).toUpperCase()}${pValueType.slice(1)} p-value`
		const pField = `${pValueType}_p_value` as 'original_p_value' | 'adjusted_p_value'
		const columns = isDM
			? [
					{ label: 'Promoter' },
					{ label: 'Gene(s)' },
					{ label: 'log₂(FC)', sortable: true },
					{ label: pLabel, sortable: true }
			  ]
			: isDAP
			? [
					{ label: 'Identifier' },
					{ label: 'Gene' },
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
			if (isDAP) {
				return [{ value: d.gene_name || '' }, { value: (d as any).gene || '' }, fc, pval]
			}
			return [{ value: d.gene_name || '' }, fc, pval]
		})
		return { columns, rows }
	}

	/** Per-data-point action menu items (Violin / DMR / Box-plot). Used by
	 * both the single-gene click flow and the multi-gene click-menu rows so
	 * the launchers stay in lock-step. */
	private getActionMenuOpts(d: DataPointEntry): ActionMenuItem[] {
		const termType = this.termType
		const interactions = this.interactions
		const all = [
			{
				label: 'Violin plot',
				isVisible: () => termType === DNA_METHYLATION || termType === GENE_EXPRESSION,
				onClick: async () => {
					if (termType === DNA_METHYLATION) interactions.launchDNAMethViolin(d as any)
					if (termType === GENE_EXPRESSION) interactions.launchViolinGeneExp(d.gene_name)
				}
			},
			{
				label: 'DMR analysis',
				isVisible: () => termType === DNA_METHYLATION,
				onClick: async () => {
					const dm = d as DataPointEntry & {
						chr: string
						start: number
						stop: number
						promoter_id?: string
						gene_name?: string
					}
					await interactions.launchDmr({
						chr: dm.chr,
						start: dm.start,
						stop: dm.stop,
						promoterId: dm.promoter_id
					})
				}
			},
			{
				label: 'Box plot',
				isVisible: () => termType === GENE_EXPRESSION,
				onClick: async () => {
					interactions.launchBoxPlot(d.gene_name)
				}
			}
		]
		return all.filter(o => o.isVisible()).map(({ label, onClick }) => ({ label, onClick }))
	}

	/** Populates a `table2col` instance with the standard volcano hover rows
	 * (gene/promoter, fold-change, original + adjusted p-values). */
	private addTooltipRows(d: DataPointEntry, table: any) {
		if (this.termType === DNA_METHYLATION) {
			if ('promoter_id' in d) addTooltipRow(table, 'Promoter', (d as any).promoter_id)
			if (d.gene_name) addTooltipRow(table, 'Gene(s)', d.gene_name)
		} else if (this.termType === PROTEOME_DAP) {
			addTooltipRow(table, 'Identifier', d.gene_name)
			if ('gene' in d) addTooltipRow(table, 'Gene', (d as any).gene)
		} else {
			addTooltipRow(table, 'Gene name', d.gene_name)
		}
		addTooltipRow(table, 'log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
		addTooltipRow(table, 'Original p-value', roundValueAuto(d.original_p_value))
		if (d.adjusted_p_value != undefined) addTooltipRow(table, 'Adjusted p-value', roundValueAuto(d.adjusted_p_value))
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
