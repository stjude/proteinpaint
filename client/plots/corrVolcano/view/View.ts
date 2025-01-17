import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import type { CorrVolcanoDom } from '../CorrelationVolcano'
import type { ViewData } from '../viewModel/ViewModel'

/** Using the data formated in ViewModel, renders the correlation
 * volcano plot. */
export class View {
	dom: CorrVolcanoDom
	viewData: ViewData
	readonly defaultRadius = 5
	constructor(dom: CorrVolcanoDom, viewData: ViewData) {
		this.viewData = viewData
		this.dom = dom

		const plotDim = viewData.plotDim
		this.renderDom(plotDim)
	}

	renderDom(plotDim) {
		this.dom.svg.transition().attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		//Y, left scale
		this.renderScale(plotDim.yScale, true)
		//X, bottom scale
		this.renderScale(plotDim.xScale)

		// Draw the line dividing the plot
		this.dom.svg
			.append('line')
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '4 2')
			.attr('x1', plotDim.divideLine.x)
			.attr('x2', plotDim.divideLine.x)
			.attr('y1', plotDim.divideLine.y1)
			.attr('y2', plotDim.divideLine.y2)

		// Draw all circles for variables
		this.renderVariables(this.viewData.variableItems)
	}

	renderScale(scale, isLeft = false) {
		const scaleG = this.dom.svg.append('g').attr('transform', `translate(${scale.x}, ${scale.y})`)
		axisstyle({
			axis: scaleG.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale)),
			color: 'black',
			showline: true
		})
		// return scaleG
	}

	renderVariables(variableItems) {
		for (const item of variableItems) {
			this.dom.svg
				.append('circle')
				.attr('stroke', item.color)
				.attr('fill', item.color)
				.attr('fill-opacity', 0.5)
				.attr('cx', item.x)
				.attr('cy', item.y)
				.attr('r', this.defaultRadius)
		}
	}
}
