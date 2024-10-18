import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'

export class View {
	readonly topPad = 20
	constructor(data, settings, dom) {
		// dom.boxplots.selectAll('*').remove()
		dom.svg
			.transition()
			.attr('width', settings.boxplotWidth)
			.attr('height', settings.rowHeight + settings.labelSpace + this.topPad * 3 + 400)

		const yScale = scaleLinear().domain([data.boxplot.min, data.boxplot.max]).range([0, settings.boxplotWidth])

		dom.yAxis.attr('transform', `translate(${settings.labelSpace}, ${this.topPad})`).transition().call(axisTop(yScale))

		axisstyle({
			axis: dom.yAxis,
			showline: true,
			fontsize: 12,
			color: 'black'
		})

		drawBoxplot({
			bp: data.boxplot,
			g: dom.boxplots
				.append('g')
				.attr('padding', '5px')
				.attr('transform', `translate(${settings.labelSpace}, ${this.topPad + 10})`),
			// .attr('transform', `translate(0, ${settings.rowHeight + settings.labelSpace})`),
			color: settings.color,
			scale: yScale,
			rowheight: settings.rowHeight,
			labpad: settings.labelSpace
		})
	}
}
