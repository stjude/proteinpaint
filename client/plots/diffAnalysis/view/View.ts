import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import type { DiffAnalysisDom } from '../DiffAnalysisTypes'
import type { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'

export class View {
	dom: DiffAnalysisDom
	interactions: DiffAnalysisInteractions
	viewData: any
	constructor(dom, interactions, viewData) {
		this.dom = dom
		this.interactions = interactions
		this.viewData = viewData

		this.interactions.clearDom()

		const plotDim = viewData.plotDim

		this.renderDom(plotDim)
		this.renderPoints()
	}

	renderDom(plotDim) {
		this.dom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.dom.yAxisLabel
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text(plotDim.yAxisLabel.text)

		this.dom.xAxisLabel
			.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
			.text('log2(fold change)')

		this.renderScale(plotDim.xScale)
		this.renderScale(plotDim.yScale, true)

		//logFoldChangeLine
		this.dom.plot
			.append('line')
			.attr('stroke', '#ccc')
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', plotDim.logFoldChangeLine.x)
			.attr('x2', plotDim.logFoldChangeLine.x)
			.attr('y2', plotDim.logFoldChangeLine.y)
	}

	renderScale(scale, isLeft = false) {
		const scaleG = this.dom.plot
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}

	renderPoints() {
		this.dom.plot
			.selectAll('circle')
			.data(this.viewData.pointData)
			.enter()
			.append('circle')
			.attr('stroke', (d: any) => d.color)
			.attr('fill', 'transparent')
			.attr('cx', (d: any) => d.x)
			.attr('cy', (d: any) => d.y)
			.attr('r', (d: any) => d.radius)
	}
}
