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
		const svg = this.dom.holder
			.append('svg')
			.style('display', 'inline-block')
			.attr('id', 'sjpp-volcano-svg')
			.style('vertical-align', 'top')
		this.volcanoDom = {
			actions,
			svg,
			xAxis: svg.append('g').attr('id', 'sjpp-volcano-xAxis'),
			yAxis: svg.append('g').attr('id', 'sjpp-volcano-yAxis'),
			xAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-xAxisLabel').attr('text-anchor', 'middle'),
			yAxisLabel: svg.append('text').attr('id', 'sjpp-volcano-yAxisLabel').attr('text-anchor', 'middle'),
			plot: svg.append('g').attr('id', 'sjpp-volcano-plot'),
			pValueTable: this.dom.holder.append('div').attr('id', 'sjpp-volcano-pValueTable').style('display', 'none')
		}
		this.termType = termType
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
		if (this.termType == 'geneExpression') {
			this.addActionButton('Confounding factors', () => this.interactions.confoundersMenu())
			this.addActionButton('Genes', () => this.interactions.launchGeneSetEdit())
			this.addActionButton('Statistics', () => {
				this.renderStatsMenu()
			})
			this.addActionButton('P Value Table', () => {
				this.volcanoDom.pValueTable.style(
					'display',
					this.volcanoDom.pValueTable.style('display') == 'none' ? 'inline-block' : 'none'
				)
			})
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

	renderStatsMenu() {
		//Render any images. viewModel returns the response array of images or []
		for (const img of this.viewData.images) {
			this.dom.actionsTip.d
				.append('img')
				.style('display', 'inline-block')
				.style('margin-left', '10px')
				.style('margin-top', '-30px')
				.attr('width', this.viewData.plotDim.svg.width + 50)
				.attr('height', this.viewData.plotDim.svg.height + 50)
				.attr('src', img.src)
		}
		const tableHolder = this.dom.actionsTip.d
			.append('div')
			//Show the stats table underneath the images if > 1 image or to the right if only 1 image
			.style('display', this.viewData.images.length > 1 ? 'block' : 'inline-block')
			//Top margin is roughly inline with image however the margins are set by server
			//Likewise the image margins are undetectable.
			//This is a roughly satistifes the different image margin scenarios.
			.style('margin', `${this.viewData.images.length > 1 ? `0px 0px` : `40px 10px`} 0px 5px`)
			.style('vertical-align', 'top')
		const table = table2col({ holder: tableHolder })
		for (const d of this.viewData.statsData) {
			const [td1, td2] = table.addRow()
			td1.text(d.label)
			td2.style('text-align', 'end').text(d.value)
		}
	}

	renderPValueTable() {
		renderTable({
			columns: this.viewData.pValueTableData.columns,
			rows: this.viewData.pValueTableData.rows,
			div: this.volcanoDom.pValueTable.append('div'),
			showLines: true,
			maxHeight: '150vh',
			resize: true,
			header: { allowSort: true }
		})
	}
}

function renderDataPoints(self: any) {
	self.volcanoDom.plot
		.selectAll('circle')
		.data(self.viewData.pointData)
		.enter()
		.append('circle')
		.attr('stroke', (d: DataPointEntry) => rgb(d.color).formatHex())
		.attr('stroke-opacity', (d: DataPointEntry) => (d.color != self.settings.defaultNonSignColor ? 0.35 : 0.2))
		.attr('stroke-width', (d: DataPointEntry) => (d.color != self.settings.defaultNonSignColor ? 1.5 : 1))
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
