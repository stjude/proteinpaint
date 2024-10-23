import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxplotDom, BoxplotSettings } from './Boxplot'

export class View {
	/** Padding for the bottom to avoid plot cutoff */
	readonly bottomPad = 20
	/** Top padding */
	readonly topPad = 20
	/** Increasing padding to space out the boxplots */
	incrTopPad = 30

	constructor(name: string, data: any, settings: BoxplotSettings, dom: BoxplotDom) {
		const dimensions = data.plotDim
		//TODO: 150 because the string label length isn't enough. Need to calculate the extra space for the labels.
		const labelsWidth = data.maxLabelLgth + settings.labelPad + 150
		//TODO: 100 for the out values. Need to calculate the width of the out values.
		const totalWidth = settings.boxplotWidth + labelsWidth + 100
		const totalHeight = dimensions.totalRowHeight * data.plots.length + this.bottomPad + this.topPad + this.incrTopPad

		dom.svg.transition().attr('width', totalWidth).attr('height', totalHeight)

		//Add 3 to the max so the upper line to boxplot isn't cutoff
		const yScale = scaleLinear()
			.domain([data.absMin, data.absMax + 3])
			.range([0, settings.boxplotWidth])
		dom.plotTitle
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${totalWidth / 2}, ${this.topPad + this.incrTopPad / 2})`)
			.text(name)
		this.incrTopPad += 10

		dom.yAxis
			.attr('transform', `translate(${labelsWidth}, ${this.topPad + this.incrTopPad})`)
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
					.attr('transform', `translate(${labelsWidth}, ${this.incrTopPad + this.topPad})`),
				color: plot.color,
				scale: yScale,
				rowheight: settings.rowHeight,
				labpad: settings.labelPad,
				labColor: 'black'
			})

			this.incrTopPad += dimensions.totalRowHeight
		}
	}
}
