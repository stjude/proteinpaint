import { drawBoxplot } from '#dom'
import { ScaleLinear, scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxPlotDom, BoxPlotSettings } from '../BoxPlot'
import type { ViewData } from '../viewModel/ViewModel'
import type { MassAppApi } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import { BoxPlotToolTips } from './BoxPlotToolTips'
import { BoxPlotLabelMenu } from './BoxPlotLabelMenu'
import { Menu } from '#dom'
import { LegendRenderer } from './LegendRender'

/** Handles all the rendering logic for the boxplot. */
export class View {
	app: MassAppApi
	id: string
	interactions: BoxPlotInteractions
	tip = new Menu()
	constructor(
		data: ViewData,
		settings: BoxPlotSettings,
		dom: BoxPlotDom,
		app: MassAppApi,
		id: string,
		interactions: BoxPlotInteractions
	) {
		this.app = app
		this.id = id
		this.interactions = interactions
		if (!data || !data.plots.length) return
		dom.plotTitle.selectAll('*').remove()
		dom.yAxis.selectAll('*').remove()
		dom.boxplots.selectAll('*').remove()
		dom.legend.selectAll('*').remove()

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
		if (data.legend) new LegendRenderer(dom.legend, data.legend, this.interactions)
	}

	renderBoxPlots(
		dom: BoxPlotDom,
		data: ViewData,
		yScale: ScaleLinear<number, number, never>,
		settings: BoxPlotSettings
	) {
		/** Draw boxplots, incrementing by the total row height */
		for (const plot of data.plots) {
			const g = dom.boxplots
				.append('g')
				.attr('id', `sjpp-boxplot-${plot.boxplot.label}`)
				.attr('padding', '5px')
				.attr('transform', `translate(${plot.x}, ${plot.y})`)

			drawBoxplot({
				bp: plot.boxplot,
				g,
				color: plot.color,
				scale: yScale,
				rowheight: settings.rowHeight,
				labpad: settings.labelPad,
				labColor: 'black'
			})

			new BoxPlotToolTips(plot, g, this.tip)
			if (data.plots.length > 1) {
				new BoxPlotLabelMenu(plot, this.app, this.id, this.interactions)
			}
		}
	}
}
