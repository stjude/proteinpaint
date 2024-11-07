import { drawBoxplot } from '#dom'
import { scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxPlotDom, BoxPlotSettings } from './BoxPlot'
import { ViewToolTips } from './ViewToolTips'

/** Handles all the rendering logic for the boxplot. */
export class View {
	constructor(data: any, settings: BoxPlotSettings, dom: BoxPlotDom) {
		if (!data || !data.plots.length) return
		const plotDim = data.plotDim
		dom.svg.transition().attr('width', plotDim.svgWidth).attr('height', plotDim.svgHeight)

		const yScale = scaleLinear().domain(plotDim.domain).range([0, settings.boxplotWidth])

		//Title of the plot
		dom.plotTitle
			.attr('id', 'sjpp-boxplot-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.title.x}, ${plotDim.title.y})`)
			.text(plotDim.title.text)

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

		this.renderBoxPlots(dom, data, yScale, settings)
		if (data.legend) this.renderLegend(dom.legend, data.legend)
	}

	renderBoxPlots(dom, data, yScale, settings) {
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

			new ViewToolTips(plot)
		}
	}

	renderLegend(legendDiv, legendData: { label: string; items: { label: string; value: number }[] }[]) {
		legendDiv.attr('id', 'sjpp-boxplot-legend')
		//Set styles and preferences in the following fns
		const addSectionTitle = (label: string) => {
			legendDiv.append('div').style('opacity', '0.5').text(label)
		}
		const addSectionDiv = () => {
			const div = legendDiv.append('div').style('padding-left', '10px')
			return div
		}
		const addData = (item: { label: string; value: number }, sectionDiv) => {
			sectionDiv.append('div').text(`${item.label}: ${item.value}`)
		}
		for (const section of legendData) {
			addSectionTitle(section.label)
			const sectionDiv = addSectionDiv()
			for (const item of section.items) {
				addData(item, sectionDiv)
			}
		}
	}
}
