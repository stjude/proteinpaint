import { axisBottom, axisLeft } from 'd3-axis'
import { axisstyle, table2col, renderTable } from '#dom'
import { select, selectAll } from 'd3-selection'
import { rgb } from 'd3-color'
import type {
	DataPointEntry,
	VolcanoDom,
	VolcanoPlotDimensions,
	VolcanoPlotDom,
	VolcanoViewData
} from '../VolcanoTypes'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { DataPointMouseEvents } from './DataPointMouseEvents'
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
			top: svg.append('g').attr('id', 'sjpp-volcano-top'),
			xAxis: svg.append('g').attr('id', 'sjpp-volcano-xAxis'),
			yAxis: svg.append('g').attr('id', 'sjpp-volcano-yAxis'),
			xAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-xAxisLabel').attr('text-anchor', 'middle'),
			yAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-yAxisLabel').attr('text-anchor', 'middle'),
			plot: svg.append('g').attr('id', 'sjpp-volcano-plot'),
			pValueTable: this.dom.holder.append('div').attr('id', 'sjpp-volcano-pValueTable').style('display', 'none')
		}
	}

	render(settings: ValidatedVolcanoSettings, viewData: VolcanoViewData) {
		this.settings = settings
		this.viewData = viewData
		const plotDim = this.viewData.plotDim
		this.renderUserActions()
		this.renderPlot(plotDim)
		renderDataPoints(this)
		this.renderFoldChangeLine(plotDim)
		this.renderStatsMenu()
		this.renderPValueTable()
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

			this.addActionButton('Show p-value table', [GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION], () => {
				this.volcanoDom.pValueTable.style(
					'display',
					this.volcanoDom.pValueTable.style('display') == 'none' ? 'inline-block' : 'none'
				)
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
			.on('click', () => {
				this.dom.actionsTip.clear().showunder(button.node())
				callback()
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

		this.volcanoDom.plot
			.append('rect')
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('stroke', '#ededed')
			.attr('fill', 'transparent')
			.attr('shape-rendering', 'crispEdges')
			.attr('transform', `translate(${plotDim.plot.x}, ${plotDim.plot.y})`)
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
	self.volcanoDom.plot
		.selectAll('circle')
		.data(self.viewData.pointData)
		.enter()
		.append('circle')
		.attr('stroke', (d: DataPointEntry) => rgb(d.color).formatHex())
		.attr('stroke-opacity', (d: DataPointEntry) => (d.significant ? 0.35 : 0.2))
		.attr('stroke-width', (d: DataPointEntry) => (d.significant ? 1.5 : 1))
		.attr('fill', self.settings.defaultHighlightColor)
		.attr('fill-opacity', (d: DataPointEntry) => (d.highlighted ? 0.9 : 0))
		.attr('cx', (d: DataPointEntry) => d.x)
		.attr('cy', (d: DataPointEntry) => d.y)
		.attr('r', (d: DataPointEntry) => d.radius)
		.each(function (this: any, d: DataPointEntry) {
			const circle = select(this)
			new DataPointMouseEvents(d, circle, self.dom.tip, self.interactions, self.termType)
		})
}
