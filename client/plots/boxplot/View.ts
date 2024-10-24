import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxplotDom, BoxplotSettings } from './Boxplot'

export class View {
	/** Increasing padding to space out the boxplots and determine position */
	private incrTopPad = 40

	constructor(name: string, data: any, settings: BoxplotSettings, dom: BoxplotDom) {
		const plotDim = data.plotDim
		const labelsWidth = plotDim.totalLabelWidth
		const totalWidth = plotDim.svgWidth
		const totalHeight = plotDim.svgHeight + this.incrTopPad

		dom.svg.transition().attr('width', totalWidth).attr('height', totalHeight)

		//Add 1 to the max so the upper line to boxplot isn't cutoff
		const yScale = scaleLinear()
			.domain([data.absMin, data.absMax + 1])
			.range([0, settings.boxplotWidth])

		//Title of the plot
		dom.plotTitle
			.attr('id', 'sjpp-boxplot-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr(
				'transform',
				`translate(${labelsWidth + settings.boxplotWidth / 2}, ${plotDim.vertPad + this.incrTopPad / 2})`
			)
			.text(name)
		this.incrTopPad += 20

		//y-axis below the title
		dom.yAxis
			.attr('id', 'sjpp-boxplot-yAxis')
			.attr('transform', `translate(${labelsWidth}, ${plotDim.vertPad + this.incrTopPad})`)
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
					.attr('id', `sjpp-boxplot-${plot.boxplot.label}`)
					.attr('padding', '5px')
					.attr('transform', `translate(${labelsWidth}, ${this.incrTopPad + plotDim.vertPad})`),
				color: plot.color,
				scale: yScale,
				rowheight: settings.rowHeight,
				labpad: settings.labelPad,
				labColor: 'black'
			})

			this.incrTopPad += plotDim.totalRowHeight
		}
	}
}
