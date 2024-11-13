import { drawBoxplot } from '#dom'
import { ScaleLinear, scaleLinear } from 'd3-scale'
import { axisstyle } from '#src/client'
import { axisTop } from 'd3-axis'
import type { BoxPlotDom, BoxPlotSettings } from './BoxPlot'
import type { ViewData, LegendItemEntry } from './ViewModel'
import type { MassAppApi } from '#mass/types/mass'
import { BoxPlotToolTips } from './BoxPlotToolTips'
import { BoxPlotLabelMenu } from './BoxPlotLabelMenu'

/** Handles all the rendering logic for the boxplot. */
export class View {
	app: MassAppApi
	id: number
	constructor(data: ViewData, settings: BoxPlotSettings, dom: BoxPlotDom, app: MassAppApi, id: number) {
		this.app = app
		this.id = id
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
		if (data.legend) this.renderLegend(dom.legend, data.legend)
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

			new BoxPlotToolTips(plot, g)
			if (data.plots.length > 1) {
				new BoxPlotLabelMenu(plot, this.app, this.id)
			}
		}
	}

	renderLegend(legendDiv, legendData: { label: string; items: LegendItemEntry[] }[]) {
		legendDiv.attr('id', 'sjpp-boxplot-legend')
		//Set styles and preferences in the following fns
		const addSectionTitle = (label: string) => {
			legendDiv.append('div').style('opacity', '0.5').text(label)
		}
		const addSectionDiv = () => {
			const div = legendDiv.append('div').style('padding-left', '10px')
			return div
		}
		const addData = (item: LegendItemEntry, sectionDiv) => {
			const legendItem = sectionDiv
				.append('div')
				.style('text-decoration', item.isHidden ? 'line-through' : '')
				.text(`${item.label}${item.value ? `: ${item.value}` : item.count ? `, n=${item.count}` : ''}`)
			if (item.isPlot && item.isHidden) {
				//Do not apply to uncomputable values, only items with plot data
				legendItem.attr('aria-label', `Click to unhide plot`).on('click', () => {
					const plotConfig = this.app.getState().plots.find(p => p.id === this.id)
					const config = structuredClone(plotConfig)
					delete config.term2.q.hiddenValues[item.label]
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config
					})
				})
			}
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
