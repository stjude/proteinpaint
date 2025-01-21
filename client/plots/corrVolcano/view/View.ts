import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import type { CorrVolcanoDom } from '../CorrelationVolcano'
import type { ViewData } from '../viewModel/ViewModel'
import { ItemToolTip } from './ItemToolTip'

/** Using the data formated in ViewModel, renders the correlation
 * volcano plot. */
export class View {
	dom: CorrVolcanoDom
	viewData: ViewData
	readonly defaultRadius = 5
	constructor(dom: CorrVolcanoDom, viewData: ViewData, interactions: any, settings: any) {
		this.dom = dom
		this.viewData = viewData

		interactions.clearDom()

		const plotDim = viewData.plotDim
		this.renderDom(plotDim)
		// Draw all circles for variables
		this.renderVariables(this.viewData.variableItems, settings)
	}

	renderDom(plotDim) {
		this.dom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.dom.title
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('x', plotDim.title.x)
			.attr('y', plotDim.title.y)
			.text(plotDim.title.text)

		this.dom.yAxisLabel
			.attr('class', 'sjpp-volcano-divide-line')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text(plotDim.yAxisLabel.text)

		//Y, left scale
		this.renderScale(plotDim.yScale, true)
		//X, bottom scale
		this.renderScale(plotDim.xScale)

		// Draw the line dividing the plot
		this.dom.svg
			.append('line')
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '5 4')
			.attr('stroke-opacity', 0.5)
			.attr('x1', plotDim.divideLine.x)
			.attr('x2', plotDim.divideLine.x)
			.attr('y1', plotDim.divideLine.y1)
			.attr('y2', plotDim.divideLine.y2)
	}

	renderScale(scale, isLeft = false) {
		const scaleG = this.dom.plot.append('g').attr('transform', `translate(${scale.x}, ${scale.y})`)
		axisstyle({
			axis: scaleG.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale)),
			color: 'black',
			showline: true
		})
		// return scaleG
	}

	renderVariables(variableItems, settings) {
		for (const item of variableItems) {
			const g = this.dom.plot
				.append('circle')
				.attr('stroke', item.color)
				.attr('fill', item.color)
				.attr('fill-opacity', 0.5)
				.attr('cx', item.x)
				.attr('cy', item.y)
				.attr('r', this.defaultRadius)

			new ItemToolTip(item, g, this.dom.tip, settings)
		}
	}
}
