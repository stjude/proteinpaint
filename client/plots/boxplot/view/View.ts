import type { ScaleLinear } from 'd3-scale'
import { drawBoxplot, Menu } from '#dom'
import { scaleLinear, scaleLog } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop, axisLeft } from 'd3-axis'
import type { BoxPlotDom, BoxPlotSettings, ViewData, PlotDimensions } from '../BoxPlotTypes'
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
	settings: BoxPlotSettings
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
		this.settings = settings
		if (!data || !data.plots.length) return

		const plotDim = data.plotDim

		dom.div.style('background-color', plotDim.backgroundColor)

		dom.svg
			.transition()
			.attr('width', plotDim.svg.width)
			.attr('height', plotDim.svg.height)
			//Fix for white background when downloading dark mode image.
			.style('fill', plotDim.backgroundColor)

		const setScaleFunc = settings.isLogScale ? scaleLog().base(10) : scaleLinear()
		const scale = setScaleFunc.domain(plotDim.domain).range(plotDim.range)

		this.renderTitle(plotDim, dom)
		this.renderBoxPlots(dom, data, scale, settings)
		this.renderAxis(plotDim, dom, scale, settings)
		if (data.legend) new LegendRenderer(dom.legend, data.legend, this.interactions, plotDim.textColor)
	}

	renderTitle(plotDim: PlotDimensions, dom: BoxPlotDom) {
		//Title of the chart
		dom.chartTitle.text(plotDim.chartTitle)

		//Title of the plot
		const transformStr = `translate(${plotDim.title.x}, ${plotDim.title.y})${
			this.settings.isVertical ? `,rotate(-90)` : ''
		}`
		dom.plotTitle
			.attr('id', 'sjpp-boxplot-title')
			.style('font-weight', 600)
			.attr('text-anchor', 'middle')
			.attr('transform', transformStr)
			.attr('fill', plotDim.textColor)
			.text(plotDim.title.text)
	}

	//Fix for the axis rendering min -> max when the plot is vertical
	renderAxis(
		plotDim: PlotDimensions,
		dom: BoxPlotDom,
		scale: ScaleLinear<number, number, never>,
		settings: BoxPlotSettings
	) {
		/** draw_boxplot renders the boxplot from min-max but the scale
		 * renders the axis from max - min. Render the box plots, then change
		 * the scale vector to match. */
		if (settings.isVertical) scale.range([scale.range()[1], scale.range()[0]])
		const ticks = scale.ticks()
		const tickValues = plotDim.axis.values(ticks)
		dom.axis
			.attr('id', 'sjpp-boxplot-axis')
			.attr('transform', `translate(${plotDim.axis.x}, ${plotDim.axis.y})`)
			.transition()
			.call(
				this.settings.isVertical
					? axisLeft(scale)
							.tickValues(tickValues)
							.tickFormat(d => plotDim.axis.format(d as number))
							.tickPadding(8)
					: axisTop(scale)
							.tickValues(tickValues)
							.tickFormat(d => plotDim.axis.format(d as number))
			)

		axisstyle({
			axis: dom.axis,
			showline: true,
			fontsize: 12,
			color: plotDim.textColor
		})
	}

	renderBoxPlots(
		dom: BoxPlotDom,
		data: ViewData,
		scale: ScaleLinear<number, number, never>,
		settings: BoxPlotSettings
	) {
		/** Draw boxplots, incrementing by the total row height */
		for (const plot of data.plots) {
			const g = dom.boxplots.append('g').attr('id', `sjpp-boxplot-${plot.boxplot.label}`).attr('padding', '5px')

			drawBoxplot({
				bp: plot.boxplot,
				g,
				color: settings.displayMode == 'filled' ? 'black' : plot.color,
				scale: scale,
				rowheight: settings.rowHeight,
				labpad: settings.labelPad,
				labColor: plot.labColor
			})

			const transformStr = `translate(${plot.x}, ${plot.y})${settings.isVertical ? `, rotate(-90)` : ''}`
			g.attr('transform', transformStr)

			if (settings.isVertical) {
				//Rotate the text slightly in veritcal orientation
				g.select('text').attr('transform', 'rotate(45)')
			}

			new BoxPlotToolTips(plot, g, this.dom.tip, settings.isVertical)
			if (data.plots.length > 1) {
				//Do not try to use the same tip for the menu as the tooltips.
				//When the boxplots are rendered close together, the menu
				//disappears to show the tooltip for the next boxplot.
				//The user can't make a selection in time.
				const labelMenuTip = new Menu({ padding: '' })
				new BoxPlotLabelMenu(
					plot as unknown as RenderedPlot,
					this.app,
					this.interactions,
					labelMenuTip,
					settings.isVertical
				)
			}
		}
	}
}
