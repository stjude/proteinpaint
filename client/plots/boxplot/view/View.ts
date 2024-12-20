import { drawBoxplot, Menu } from '#dom'
import { scaleLinear } from 'd3-scale'
import type { ScaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxPlotDom, BoxPlotSettings } from '../BoxPlot'
import type { ViewData } from '../viewModel/ViewModel'
import type { MassAppApi } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import type { RenderedPlot } from './RenderedPlot'
import { BoxPlotToolTips } from './BoxPlotToolTips'
import { BoxPlotLabelMenu } from './BoxPlotLabelMenu'
import { LegendRenderer } from './LegendRender'

/** Handles all the rendering logic for the boxplot. */
export class View {
	app: MassAppApi
	dom: BoxPlotDom
	interactions: BoxPlotInteractions
	constructor(
		data: ViewData,
		settings: BoxPlotSettings,
		dom: BoxPlotDom,
		app: MassAppApi,
		interactions: BoxPlotInteractions
	) {
		this.app = app
		this.dom = dom
		this.interactions = interactions
		if (!data || !data.plots.length) return
		this.interactions.clearDom()

		const plotDim = data.plotDim

		dom.div.style('background-color', plotDim.backgroundColor)

		dom.svg.transition().attr('width', plotDim.svgWidth).attr('height', plotDim.svgHeight)

		const yScale = scaleLinear().domain(plotDim.domain).range([0, settings.boxplotWidth])

		this.renderDom(plotDim, dom, yScale)
		this.renderBoxPlots(dom, data, yScale, settings)
		if (data.legend) new LegendRenderer(dom.legend, data.legend, this.interactions, plotDim.textColor)
	}

	renderDom(plotDim: any, dom: BoxPlotDom, yScale: ScaleLinear<number, number, never>) {
		//Title of the plot
		dom.plotTitle
			.attr('id', 'sjpp-boxplot-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${plotDim.title.x}, ${plotDim.title.y})`)
			.attr('fill', plotDim.textColor)
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
			color: plotDim.textColor
		})
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
				labColor: plot.labColor
			})

			new BoxPlotToolTips(plot, g, this.dom.tip)
			if (data.plots.length > 1) {
				//Do not try to use the same tip for the menu as the tooltips.
				//When the boxplots are rendered close together, the menu
				//disappears to show the tooltip for the next boxplot.
				//The user can't make a selection in time.
				const labelMenuTip = new Menu({ padding: '' })
				new BoxPlotLabelMenu(plot as unknown as RenderedPlot, this.app, this.interactions, labelMenuTip)
			}
		}
		dom.boxplots.selectAll('g[id^="sjpp-boxplot-"] > rect').style('fill', data.plotDim.backgroundColor)
	}
}
