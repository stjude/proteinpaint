import type { BoxPlotSettings } from '../BoxPlot'
import type { BoxPlotResponse, BoxPlotEntry, BoxPlotData } from '#types'
import type { PlotConfig } from '#mass/types/mass'
import type { LegendItemEntry } from './LegendDataMapper'
import { LegendDataMapper } from './LegendDataMapper'

/**
 * Calculates the dimensions and html attributes for the svg and
 * individual boxplots. The data is passed to the View class.
 */

export type ViewData = {
	plotDim: PlotDimensions
	plots: FormattedPlotEntry[]
	legend: { label: string; items: LegendItemEntry[] }[]
}

export type FormattedPlotEntry = BoxPlotEntry & {
	boxplot: BoxPlotData & { label: string; radius?: number }
	x: number
	y: number
	labColor: string
}

type PlotDimensions = {
	backgroundColor: string
	/** Domain for the y-axis */
	domain: number[]
	/** Width of the svg */
	svgWidth: number
	/** Height of the svg */
	svgHeight: number
	textColor: string
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
	incrTopPad = 40
	/** Range is 20 - 50 */
	rowHeight: number
	/** Range is 10 -20 */
	rowSpace: number
	viewData: ViewData
	constructor(
		config: PlotConfig,
		data: BoxPlotResponse,
		settings: BoxPlotSettings,
		maxLabelLgth: number,
		useDefaultSettings: boolean
	) {
		/** As requested, adjust the size of each plot based on the number of boxplots
		 * Manages rendering very large svgs. */
		const numOfPlots = data.plots.filter(p => !p.isHidden).length
		if (useDefaultSettings) {
			const isLargePlotCount = numOfPlots > 20
			this.rowHeight = numOfPlots > 10 ? (isLargePlotCount ? 20 : 35) : 50
			this.rowSpace = numOfPlots > 10 ? (isLargePlotCount ? 10 : 12) : 15
		} else {
			this.rowHeight = settings.rowHeight
			this.rowSpace = settings.rowSpace
		}

		const totalLabelWidth = maxLabelLgth + settings.labelPad
		const totalRowHeight = this.rowHeight + this.rowSpace

		const plotDim = this.setPlotDimensions(data, config, settings, totalLabelWidth, totalRowHeight)
		//20 for the yAxis offset (above), 10 more for the first boxplot
		this.incrTopPad += 30

		const plots = this.setPlotData(data, config, settings, totalLabelWidth, totalRowHeight)

		this.viewData = {
			plotDim: plotDim as PlotDimensions,
			plots: plots.filter(p => !p.isHidden),
			legend: new LegendDataMapper(config, data, plots).legendData
		}
	}

	setPlotDimensions(
		data: BoxPlotResponse,
		config: any,
		settings: BoxPlotSettings,
		totalLabelWidth: number,
		totalRowHeight: number
	) {
		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 */
		const plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			//Note: ts is complaining absMax could be null. Ignore. Error in server request.
			domain: [data.absMin, data.absMax! <= 1 ? data.absMax : data.absMax! + 1],
			svgWidth: settings.boxplotWidth + totalLabelWidth + this.horizPad,
			svgHeight:
				data.plots.filter(p => !p.isHidden).length * totalRowHeight + this.topPad + this.bottomPad + this.incrTopPad,
			title: {
				x: totalLabelWidth + settings.boxplotWidth / 2,
				y: this.topPad + this.incrTopPad / 2,
				text: config.term.q.mode == 'continuous' ? config.term.term.name : config.term2.term.name
			},
			yAxis: {
				x: totalLabelWidth,
				y: this.topPad + this.incrTopPad + 20
			},
			backgroundColor: settings.darkMode ? '#353839' : 'white',
			textColor: settings.darkMode ? 'white' : 'black'
		}
		return plotDim
	}

	setPlotData(data: any, config: any, settings: BoxPlotSettings, totalLabelWidth: number, totalRowHeight: number) {
		const plots = structuredClone(data.plots)
		for (const plot of plots) {
			/** Set rendering properties for the plot */

			//Set the color for all plots
			if (!plot.color) plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color
			//Ignore if hidden after the color is set
			if (plot.isHidden) continue
			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a: { value: number }, b: { value: number }) =>
					Math.max(a.value, b.value)
				)
				if (maxOut && maxOut.value > data.absMax) data.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
			plot.labColor = settings.darkMode ? 'white' : 'black'
			plot.x = totalLabelWidth
			plot.y = this.topPad + this.incrTopPad
			this.incrTopPad += totalRowHeight
		}
		return plots
	}
}
