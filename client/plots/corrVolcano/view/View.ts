import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import { select } from 'd3-selection'
import { LegendCircleReference } from '#dom'
import type {
	CorrVolcanoDom,
	CorrVolcanoSettings,
	CorrVolcanoLegendData,
	CorrVolcanoPlotDimensions,
	CorrVolcanoViewData
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
	readonly duration = 500
	viewData: CorrVolcanoViewData
	constructor(
		dom: CorrVolcanoDom,
		viewData: CorrVolcanoViewData,
		interactions: CorrVolcanoInteractions,
		settings: CorrVolcanoSettings,
		defaultMaxRadius: number,
		defaultMinRadius: number
	) {
		this.dom = dom
		this.viewData = viewData

		interactions.clearDom()

		const plotDim = viewData.plotDim
		this.renderDom(plotDim)
		// Draw all circles for variables
		renderVariables(this, settings, interactions)
		this.renderLegend(viewData.legendData, settings, interactions, defaultMaxRadius, defaultMinRadius)
	}

	renderDom(plotDim: CorrVolcanoPlotDimensions) {
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
		const scaleG = this.dom.plot
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.transition()
			.duration(this.duration)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}

	renderLegend(
		legendData: CorrVolcanoLegendData,
		settings: CorrVolcanoSettings,
		interactions: CorrVolcanoInteractions,
		defaultMaxRadius: number,
		defaultMinRadius: number
	) {
		const svg = this.dom.legend
			.attr('width', 400)
			//TODO: calculate the height based on the number of skipped terms and max radius
			.attr('height', 400)
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding-top', '20px')

		const startXPos = 20
		const startYPos = 20

		new LegendCircleReference({
			g: svg.append('g').attr('transform', `translate(${startXPos}, ${startYPos})`),
			inputMax: defaultMaxRadius,
			inputMin: defaultMinRadius,
			maxLabel: legendData.absMax,
			maxRadius: settings.radiusMax,
			minLabel: legendData.absMin,
			minRadius: settings.radiusMin,
			title: 'Sample Size',
			menu: {
				minMaxLabel: 'pixels',
				callback: async obj => {
					await interactions.changeRadius(obj)
				}
			}
		})

		/** Show terms with no data to the user */
		if (legendData.skippedVariables.length > 0) {
			const newYPos = startYPos + settings.radiusMax + 60
			let incrY = 30
			const skippedVariablesG = svg.append('g').attr('transform', `translate(${startXPos}, ${newYPos})`)
			//Styling matches the legend circle reference
			skippedVariablesG
				.append('text')
				.style('font-weight', 'bold')
				.style('font-size', '0.8em')
				.text('Skipped Variables')

			for (const term of legendData.skippedVariables) {
				skippedVariablesG
					.append('text')
					.attr('transform', `translate(${startXPos}, ${incrY})`)
					.style('font-size', '0.8em')
					.text(term.label)
				incrY += 20
			}
		}
	}
}

function renderVariables(self, settings: CorrVolcanoSettings, interactions: CorrVolcanoInteractions) {
	self.dom.plot
		.selectAll('circle')
		.data(self.viewData.variableItems)
		.enter()
		.append('circle')
		.attr('id', item => `sjpp-corr-volcano-circle-${item.label}`)
		.attr('stroke', item => item.color)
		.attr('fill', item => item.color)
		.attr('fill-opacity', 0.5)
		.attr('cx', item => item.previousX)
		.attr('cy', item => item.previousY)
		//Allows for a subtle transition to new position
		.attr('r', item => item.radius * 0.9)
		.transition()
		.duration(self.duration)
		.attr('cx', item => item.x)
		.attr('cy', item => item.y)
		.attr('r', item => item.radius)
		.each(function (this, item) {
			const circle = select(this)
			new ItemToolTip(item, circle, self.dom.tip, settings)
			circle.on('click', () => {
				interactions.launchSampleScatter(item)
			})
		})
}
