import type { BoxPlotSettings } from './BoxPlot'
import type { BoxPlotResponse, BoxPlotData, BoxPlotDescrStatsEntry } from '#types'

/**
 * Calculates the dimensions and html attributes for the svg and
 * individual boxplots. The data is passed to the View class.
 *
 * TODO:
 *  Calculate the space needed for the labels rather than hardcoding with padding
 */

export type ViewData = {
	plotDim: PlotDimensions
	plots: Plots[]
	legend: { label: string; items: { label: string; value: number }[] }[]
}

type Plots = {
	boxplot: BoxPlotData & { label: string }
	descrStats: BoxPlotDescrStatsEntry
	color: string
	x: number
	y: number
}

type PlotDimensions = {
	/** Domain for the y-axis */
	domain: number[]
	/** Width of the svg */
	svgWidth: number
	/** Height of the svg */
	svgHeight: number
	/** Title of the plot and coordinates */
	title: { x: number; y: number; text: string }
	/** y-axis coordinates */
	yAxis: { x: number; y: number }
}

export class ViewModel {
	/** Top padding for the svg */
	readonly topPad = 20
	/** Bottom padding for the svg */
	readonly bottomPad = 40
	/** Horizontal, or right and left padding */
	readonly horizPad = 120
	/** For outliers, set a radius rather than using the default. */
	readonly outRadius = 5
	/** Increasing padding to space out the boxplots and determine position */
	private incrTopPad = 40
	viewData!: ViewData
	constructor(config: any, data: BoxPlotResponse, settings: BoxPlotSettings) {
		if (!data || !data.plots?.length) return

		const totalLabelWidth = data.maxLabelLgth * 4 + settings.labelPad + this.horizPad
		const totalRowHeight = settings.rowHeight + settings.rowSpace

		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 */
		const plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			//Note: ts is complaining absMax could be null. Ignore. Throws error in request.
			domain: [data.absMin, data.absMax! <= 1 ? data.absMax : data.absMax! + 1],
			svgWidth: settings.boxplotWidth + totalLabelWidth + this.horizPad,
			svgHeight: data.plots.length * totalRowHeight + this.topPad + this.bottomPad + this.incrTopPad,
			title: {
				x: totalLabelWidth + settings.boxplotWidth / 2,
				y: this.topPad + this.incrTopPad / 2,
				text: config.term.q.mode == 'continuous' ? config.term.term.name : config.term2.term.name
			},
			yAxis: {
				x: totalLabelWidth,
				y: this.topPad + this.incrTopPad + 20
			}
		}
		//20 for the yAxis offset (above), 10 more for the first boxplot
		this.incrTopPad += 30
		const plots = this.setPlotData(data, config, settings, totalLabelWidth, totalRowHeight)
		const legend = this.setLegendData(config, data)

		this.viewData = {
			plotDim: plotDim as PlotDimensions,
			plots,
			legend
		}
	}

	setPlotData(data: any, config: any, settings: BoxPlotSettings, totalLabelWidth: number, totalRowHeight: number) {
		const plots = structuredClone(data.plots)
		for (const plot of plots) {
			//Set rendering properties for the plot
			if (!plot.color) plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color

			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a: { value: number }, b: { value: number }) =>
					Math.max(a.value, b.value)
				)
				if (maxOut && maxOut.value > data.absMax) data.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
			plot.x = totalLabelWidth
			plot.y = this.topPad + this.incrTopPad
			this.incrTopPad += totalRowHeight
		}
		return plots
	}

	setLegendData(config: any, data: BoxPlotResponse) {
		const legendData: { label: string; items: { label: string; value: number }[] }[] = []
		const isTerm2 = config?.term2 && config.term2.q?.descrStats
		if (config.term.q?.descrStats) {
			legendData.push({
				label: `Descriptive Statistics${isTerm2 ? `: ${config.term.term.name}` : ''}`,
				items: config.term.q.descrStats
			})
		}
		if (isTerm2) {
			legendData.push({
				label: `Descriptive Statistics: ${config.term2.term.name}`,
				items: config.term2.q.descrStats
			})
		}
		if (data.uncomputableValues != null) {
			legendData.push({
				label: 'Other categories',
				items: data.uncomputableValues
			})
		}
		return legendData
	}
}
