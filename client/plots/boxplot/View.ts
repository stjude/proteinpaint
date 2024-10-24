import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxplotDom, BoxplotSettings } from './Boxplot'

export class View {
	/** Vertical, or top and bottom padding */
	readonly vertPad = 20
	/** Horizontal, or right and left padding */
	readonly horizPad = 100
	/** Increasing padding to space out the boxplots and determine position */
	incrTopPad = 30

	constructor(name: string, data: any, settings: BoxplotSettings, dom: BoxplotDom) {
		const dimensions = data.plotDim
		const labelsWidth = dimensions.totalLabelWidth + this.horizPad
		const totalWidth = dimensions.svgWidth + this.horizPad
		const totalHeight = dimensions.svgHeight + this.vertPad * 2 + this.incrTopPad

		dom.svg.transition().attr('width', totalWidth).attr('height', totalHeight)

		//Add 3 to the max so the upper line to boxplot isn't cutoff
		const yScale = scaleLinear()
			.domain([data.absMin, data.absMax + 3])
			.range([0, settings.boxplotWidth])

		//Title of the plot
		dom.plotTitle
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${labelsWidth + settings.boxplotWidth / 2}, ${this.vertPad + this.incrTopPad / 2})`)
			.text(name)
		this.incrTopPad += 20

		//y-axis below the title
		dom.yAxis
			.attr('transform', `translate(${labelsWidth}, ${this.vertPad + this.incrTopPad})`)
			.transition()
			.call(axisTop(yScale))
		this.incrTopPad += 10

		axisstyle({
			axis: dom.yAxis,
			showline: true,
			fontsize: 12,
			color: 'black'
		})

		/** Draw boxplots, incrementing by the total row height */
		for (const plot of data.plots) {
			drawBoxplot({
				bp: plot.boxplot,
				g: dom.boxplots
					.append('g')
					.attr('padding', '5px')
					.attr('transform', `translate(${labelsWidth}, ${this.incrTopPad + this.vertPad})`),
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
