import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxplotDom, BoxplotSettings } from './Boxplot'

export class View {
	constructor(data: any, settings: BoxplotSettings, dom: BoxplotDom) {
		const plotDim = data.plotDim
		dom.svg.transition().attr('width', plotDim.svgWidth).attr('height', plotDim.svgHeight)

		//Add 1 to the max so the upper line to boxplot isn't cutoff
		const yScale = scaleLinear()
			.domain([data.absMin, data.absMax + 1])
			.range([0, settings.boxplotWidth])

		//Title of the plot
		dom.plotTitle
			.attr('id', 'sjpp-boxplot-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.title.x}, ${plotDim.title.y})`)
			.text(data.plotTitle)

		//y-axis below the title
		dom.yAxis
			.attr('id', 'sjpp-boxplot-yAxis')
			.attr('transform', `translate(${plotDim.yAxis.x}, ${plotDim.yAxis.y})`)
			.transition()
			.call(axisTop(yScale))

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
					.attr('transform', `translate(${plot.x}, ${plot.y})`),
				color: plot.color,
				scale: yScale,
				rowheight: settings.rowHeight,
				labpad: settings.labelPad,
				labColor: 'black'
			})
		}
	}
}
