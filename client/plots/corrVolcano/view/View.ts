import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'

/** Using the data formated in ViewModel, renders the correlation
 * volcano plot. */
export class View {
	dom: any
	viewData: any
	readonly defaultRadius = 5
	constructor(dom, viewData) {
		this.viewData = viewData
		this.dom = dom

		const plotDim = viewData.plotDim
		this.renderDom(plotDim)
	}

	renderDom(plotDim) {
		this.dom.svg.transition().attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.renderScale(plotDim.yScale, true)
		this.renderScale(plotDim.xScale)

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
		for (const v of variableItems) {
			this.dom.svg
				.append('circle')
				.attr('stroke', v.color)
				.attr('fill', v.color)
				.attr('cx', v.x)
				.attr('cy', v.y)
				.attr('r', this.defaultRadius)
		}
	}
}
