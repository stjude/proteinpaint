import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import { table2col } from '#dom'
import { select } from 'd3-selection'
import type { DiffAnalysisDom, DiffAnalysisPlotDim, DiffAnalysisViewData, PointDataEntry } from '../DiffAnalysisTypes'
import type { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'

export class View {
	dom: DiffAnalysisDom
	interactions: DiffAnalysisInteractions
	viewData: DiffAnalysisViewData
	constructor(dom: DiffAnalysisDom, interactions: DiffAnalysisInteractions, viewData: DiffAnalysisViewData) {
		this.dom = dom
		this.interactions = interactions
		this.viewData = viewData

		this.interactions.clearDom()

		const plotDim = this.viewData.plotDim
		this.renderDom(plotDim)
		this.renderDataPoints()
		this.renderFoldChangeLine(plotDim)
		this.renderStatsTable()
	}

	renderDom(plotDim: DiffAnalysisPlotDim) {
		this.dom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.dom.yAxisLabel
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text(plotDim.yAxisLabel.text)

		this.dom.xAxisLabel
			.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
			.text('log2(fold change)')

		this.renderScale(plotDim.xScale)
		this.renderScale(plotDim.yScale, true)

		this.dom.plot
			.append('rect')
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('stroke', '#ededed')
			.attr('fill', 'transparent')
			.attr('shape-rendering', 'crispEdges')
			.attr('transform', `translate(${plotDim.plot.x}, ${plotDim.plot.y})`)
	}

	renderScale(scale: any, isLeft = false) {
		const scaleG = this.dom[isLeft ? 'yAxis' : 'xAxis']
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}

	renderDataPoints() {
		this.dom.plot
			.selectAll('circle')
			.data(this.viewData.pointData)
			.enter()
			.append('circle')
			.attr('stroke', (d: PointDataEntry) => d.color)
			.attr('stroke-opacity', 0.2)
			.attr('stroke-width', 1)
			// orange yellow fill shown on hover
			.attr('fill', '#ffa200')
			.attr('fill-opacity', 0)
			.attr('cx', (d: PointDataEntry) => d.x)
			.attr('cy', (d: PointDataEntry) => d.y)
			.attr('r', (d: PointDataEntry) => d.radius)
			.each(function (this, d: PointDataEntry) {
				const circle = select(this)
				//TODO: add tooltip
				circle.on('click', () => {
					//TODO: launch genome browser
				})
			})
			.on('mouseover', (d: PointDataEntry) => {
				//TODO: change color
			})
			.on('mouseout', (d: PointDataEntry) => {
				//TODO: change color back
			})
	}

	renderFoldChangeLine(plotDim: DiffAnalysisPlotDim) {
		//logFoldChangeLine
		this.dom.plot
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
		const holder = this.dom.div
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '50px')
		const table = table2col({ holder })
		for (const d of statsData) {
			const [td1, td2] = table.addRow()
			td1.text(d.label)
			td2.style('text-align', 'end').text(d.value)
		}
	}
}
