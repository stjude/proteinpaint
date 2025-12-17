import type { BoxPlotSettings } from '../Settings'
import type { ViewData, FormattedBoxPlotChartsEntry } from '../BoxPlotTypes'
import type { MassAppApi } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import { LegendRenderer } from './LegendRender'
import { ChartRender } from './ChartRender'

/** Handles rendering each chart and the legend */
export class View {
	app: MassAppApi
	dom: any
	interactions: BoxPlotInteractions
	settings: BoxPlotSettings
	constructor(
		viewData: ViewData,
		settings: BoxPlotSettings,
		dom: any,
		app: MassAppApi,
		interactions: BoxPlotInteractions
	) {
		this.app = app
		this.dom = dom
		this.interactions = interactions
		this.settings = settings
		if (!viewData || !viewData.charts) return

		dom.div.style('background-color', viewData.backgroundColor)

		for (const chart of Object.values(viewData.charts) as FormattedBoxPlotChartsEntry[]) {
			const chartWrapper = dom.charts.append('div').attr('class', 'sjpp-boxplot-chart-wrapper')

			const svg = chartWrapper.append('svg').attr('class', 'sjpp-boxplot-svg')

			/** Enables downloading the chart image for
			 * DownloadMenu after rendering. */
			chart['svg'] = svg

			const chartDom: any = {
				svg,
				tip: dom.tip
			}
			if (chart.plotDim.subtitle.text) {
				chartDom.subtitle = svg.append('text')
			}
			chartDom.title = svg.append('text')
			chartDom.axis = svg.append('g')
			chartDom.boxplots = svg.append('g').attr('class', 'sjpp-boxplot-boxplots')

			if (chart.wilcoxon) {
				chartDom.assocTableDiv = chartWrapper
					.append('div')
					.attr('class', 'sjpp-boxplot-wilcoxon')
					.style('display', 'inline-block')
			}

			new ChartRender(
				chartDom,
				this.settings,
				this.app,
				this.interactions,
				chart,
				viewData.backgroundColor,
				viewData.textColor
			)
		}

		new LegendRenderer(dom.legend, viewData.legend, interactions, viewData.textColor)
	}
}
