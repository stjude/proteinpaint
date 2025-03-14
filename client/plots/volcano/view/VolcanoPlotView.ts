import { axisBottom, axisLeft } from 'd3-axis'
import { axisstyle, table2col, renderTable } from '#dom'
import { select } from 'd3-selection'
import { rgb } from 'd3-color'
import type {
	DataPointEntry,
	VolcanoDom,
	VolcanoPlotDimensions,
	VolcanoPlotDom,
	VolcanoSettings,
	VolcanoViewData
} from '../VolcanoTypes'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { DataPointMouseEvents } from './DataPointMouseEvents'

export class VolcanoPlotView {
	dom: VolcanoDom
	interactions: VolcanoInteractions
	settings: VolcanoSettings
	termType: string
	volcanoDom: VolcanoPlotDom
	viewData: VolcanoViewData
	constructor(
		dom: VolcanoDom,
		settings: VolcanoSettings,
		viewData: VolcanoViewData,
		interactions: VolcanoInteractions,
		termType: string
	) {
		this.dom = dom
		this.interactions = interactions
		this.settings = settings
		this.viewData = viewData
		const actions = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-actions')
			.style('display', 'block')
			.style('z-index', 1)
			.style('position', 'relative')
		const images = this.dom.holder
			.append('div')
			.style('display', settings.showImages ? 'block' : 'none')
			.style('vertical-align', 'top')
			.attr('id', 'sjpp-volcano-images')
		const svg = this.dom.holder.append('svg').style('display', 'inline-block').attr('id', 'sjpp-volcano-svg')
		this.volcanoDom = {
			actions,
			images,
			svg,
			xAxis: svg.append('g').attr('id', 'sjpp-volcano-xAxis'),
			yAxis: svg.append('g').attr('id', 'sjpp-volcano-yAxis'),
			xAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-xAxisLabel').attr('text-anchor', 'middle'),
			yAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-yAxisLabel').attr('text-anchor', 'middle'),
			plot: svg.append('g').attr('id', 'sjpp-volcano-plot')
		}
		this.termType = termType

		const plotDim = this.viewData.plotDim
		this.renderUserActions()
		this.renderPlot(plotDim)
		renderDataPoints(this)
		this.renderFoldChangeLine(plotDim)
		this.renderStatsTable()
		this.renderPValueTable()
		this.renderImages()
	}

	renderUserActions() {
		this.volcanoDom.actions.style('margin-left', '20px').style('padding', '5px')
		if (this.termType == 'geneExpression') {
			this.addActionButton('Confounding factors', () => this.interactions.confoundersMenu())
			this.addActionButton('Genes', () => this.interactions.launchGeneSetEdit())
			if (this.viewData.images.length) {
				const btnLabel = `Image${this.viewData.images.length > 1 ? `s (${this.viewData.images.length})` : ''}`
				this.addActionButton(btnLabel, () => {
					this.interactions.showImages()
				})
			}
		}
	}

	addActionButton(text: string, callback: any) {
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

		this.volcanoDom.yAxisLabel
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text(plotDim.yAxisLabel.text)

		this.volcanoDom.xAxisLabel
			.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
			.text('log2(fold change)')

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

	renderStatsTable() {
		const statsData = this.viewData.statsData
		const holder = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-volcano-stats')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '20px')
		const table = table2col({ holder })
		for (const d of statsData) {
			const [td1, td2] = table.addRow()
			td1.text(d.label)
			td2.style('text-align', 'end').text(d.value)
		}
	}

	renderPValueTable() {
		if (!this.settings.showPValueTable) {
			this.dom.holder.selectAll('div[id="sjpp-volcano-pValueTable"]').remove()
			return
		}
		const tableDiv = this.dom.holder.append('div').attr('id', 'sjpp-volcano-pValueTable')
		renderTable({
			columns: this.viewData.pValueTableData.columns,
			rows: this.viewData.pValueTableData.rows,
			div: tableDiv.append('div'),
			showLines: true,
			maxHeight: '150vh',
			resize: true,
			header: { allowSort: true }
		})
	}

	renderImages() {
		if (!this.viewData.images.length) return
		/** images div styling accounts for the margins in the images. 
		Remove these styles and '+50' if the margins are removed 
		in the generated images. */
		this.volcanoDom.images.style('margin-top', '-60px').style('z-index', -1)
		for (const img of this.viewData.images) {
			this.volcanoDom.images
				.append('img')
				.attr('width', this.viewData.plotDim.svg.width + 50)
				.attr('height', this.viewData.plotDim.svg.height + 50)
				.attr('src', img.src)
		}
	}
}

function renderDataPoints(self: any) {
	self.volcanoDom.plot
		.selectAll('circle')
		.data(self.viewData.pointData)
		.enter()
		.append('circle')
		.attr('stroke', (d: DataPointEntry) => rgb(d.color).formatHex())
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		.attr('fill', (d: DataPointEntry) =>
			d.highlighted ? rgb(d.color).formatHex() : self.settings.defaultHighlightColor
		)
		.attr('fill-opacity', (d: DataPointEntry) => (d.highlighted ? 0.9 : 0))
		.attr('cx', (d: DataPointEntry) => d.x)
		.attr('cy', (d: DataPointEntry) => d.y)
		.attr('r', (d: DataPointEntry) => d.radius)
		.each(function (this: any, d: DataPointEntry) {
			const circle = select(this)
			new DataPointMouseEvents(d, circle, self.dom.tip, self.interactions, self.termType)
		})
}
