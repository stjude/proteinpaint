import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import type {
	CorrVolcanoDom,
	CorrVolcanoSettings,
	LegendDataEntry,
	PlotDimensions,
	ViewData
} from '../CorrelationVolcanoTypes'
import type { CorrVolcanoInteractions } from '../interactions/CorrVolcanoInteractions'
import { ItemToolTip } from './ItemToolTip'

/**
 * TODO - finish typing this file
 *
 * Using the data formated in ViewModel, renders the correlation
 * volcano plot. */
export class View {
	dom: CorrVolcanoDom
	viewData: ViewData
	constructor(
		dom: CorrVolcanoDom,
		viewData: ViewData,
		interactions: CorrVolcanoInteractions,
		settings: CorrVolcanoSettings
	) {
		this.dom = dom
		this.viewData = viewData

		interactions.clearDom()

		const plotDim = viewData.plotDim
		this.renderDom(plotDim)
		// Draw all circles for variables
		this.renderVariables(this.viewData.variableItems, settings, interactions)
		this.renderLegend(viewData.legendData)
	}

	renderDom(plotDim: PlotDimensions) {
		this.dom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.dom.title
			.attr('class', 'sjpp-corr-volcano-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('x', plotDim.title.x)
			.attr('y', plotDim.title.y)
			.text(plotDim.title.text)

		this.dom.yAxisLabel
			.attr('class', 'sjpp-corr-volcano-y-axis')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text('-log10(p value)')

		this.dom.xAxisLabel
			.attr('class', 'sjpp-corr-volcano-x-axis')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
			.html('Correlation Coefficient (&#961;)') //unicode for rho

		//Y, left scale
		this.renderScale(plotDim.yScale, true)
		//X, bottom scale
		this.renderScale(plotDim.xScale)

		// Draw a line demarcating correlation and anticorrelation
		this.dom.svg
			.append('line')
			.attr('class', 'sjpp-corr-volcano-divide-line')
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '5 4')
			.attr('stroke-opacity', 0.4)
			.attr('x1', plotDim.divideLine.x)
			.attr('x2', plotDim.divideLine.x)
			.attr('y1', plotDim.divideLine.y1)
			.attr('y2', plotDim.divideLine.y2)

		//Draw threshold indicating statiscally significant values
		this.dom.svg
			.append('line')
			.attr('class', 'sjpp-corr-volcano-threshold-line')
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '5 4')
			.attr('stroke-opacity', 0.4)
			.attr('x1', plotDim.thresholdLine.x1)
			.attr('x2', plotDim.thresholdLine.x2)
			.attr('y1', plotDim.thresholdLine.y)
			.attr('y2', plotDim.thresholdLine.y)
	}

	renderScale(scale, isLeft = false) {
		const scaleG = this.dom.plot.append('g').attr('transform', `translate(${scale.x}, ${scale.y})`)
		axisstyle({
			axis: scaleG.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale)),
			color: 'black',
			showline: true
		})
	}

	renderVariables(variableItems, settings: CorrVolcanoSettings, interactions: CorrVolcanoInteractions) {
		for (const item of variableItems) {
			const circle = this.dom.plot
				.append('circle')
				.attr('data-testid', `sjpp-corr-volcano-circle-${item.label}`)
				.attr('stroke', item.color)
				.attr('fill', item.color)
				.attr('fill-opacity', 0.5)
				.attr('cx', item.x)
				.attr('cy', item.y)
				.attr('r', 0)
				.on('click', () => {
					interactions.launchSampleScatter(item)
				})

			new ItemToolTip(item, circle, this.dom.tip, settings)
			//Animate the circle to its final radius
			circle.transition().duration(500).attr('r', item.radius)
		}
	}

	renderLegend(legendData: LegendDataEntry[]) {
		const svg = this.dom.legend
			.attr('width', 100)
			.attr('height', 100)
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding-top', '20px')
		svg.append('text').text('Sample size').attr('x', 10).attr('y', 15)

		for (const c of legendData) {
			svg
				.append('circle')
				.attr('fill', 'lightgrey')
				.attr('stroke', 'lightgrey')
				.attr('cx', c.x)
				.attr('cy', c.y)
				.attr('r', c.radius)

			svg
				.append('text')
				.attr('x', c.x + 25)
				.attr('y', c.y + 5)
				.text(c.label)
		}
	}
}
