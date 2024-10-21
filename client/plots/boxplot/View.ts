import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'

export class View {
	readonly topPad = 20
	incrTopPad = 30

	constructor(term, data, settings, dom) {
		dom.svg
			.transition()
			.attr('width', settings.boxplotWidth)
			.attr('height', (settings.rowHeight + settings.labelSpace + this.topPad * 3) * data.plots.length)

		//Add 3 to the max so the upper line to boxplot isn't cutoff
		const yScale = scaleLinear()
			.domain([data.absMin, data.absMax + 3])
			.range([0, settings.boxplotWidth])
		dom.plotTitle
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${(settings.boxplotWidth + 3) / 2}, ${this.topPad + this.incrTopPad / 2})`)
			.text(term.name)
		this.incrTopPad += 10

		dom.yAxis
			.attr('transform', `translate(${settings.labelSpace}, ${this.topPad + this.incrTopPad})`)
			.transition()
			.call(axisTop(yScale))
		this.incrTopPad += 10

		axisstyle({
			axis: dom.yAxis,
			showline: true,
			fontsize: 12,
			color: 'black'
		})

		for (const plot of data.plots) {
			drawBoxplot({
				bp: plot.boxplot,
				g: dom.boxplots
					.append('g')
					.attr('padding', '5px')
					.attr('transform', `translate(${settings.labelSpace}, ${this.topPad + this.incrTopPad})`),
				color: settings.color,
				scale: yScale,
				rowheight: settings.rowHeight,
				labpad: settings.labelSpace
			})

			this.incrTopPad += settings.rowHeight + 10
		}
	}
}
