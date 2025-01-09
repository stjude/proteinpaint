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
	/** offset for the label div */
	x: number
	/** incrementing, descending offset for each new plot  */
	y: number
	/** Plot label color. Changes per darkMode selection */
	labColor: string
}

export type PlotDimensions = {
	/** Changes background color between white and soft black
	 * based on darkMode selection */
	backgroundColor: string
	/** Domain for the axis */
	domain: number[]
	/** Range for the axis */
	range: number[]
	svg: {
		/** Width of the svg */
		width: number
		/** Height of the svg */
		height: number
	}
	/** Changes text color for the axis, plot labels, and legend
	 * between black and white based on darkMode selection */
	textColor: string
	/** Title of the plot and coordinates */
	title: { x: number; y: number; text: string }
	/** axis coordinates */
	axis: { x: number; y: number }
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
	incrPad = 40
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

		const totalLabelSize = maxLabelLgth + settings.labelPad
		const totalRowSize = this.rowHeight + this.rowSpace

		const plotDim = this.setPlotDimensions(data, config, settings, totalLabelSize, totalRowSize)
		//20 for the axis offset (above), 10 more for the first boxplot
		this.incrPad += 30

		const plots = this.setPlotData(data, config, settings, totalLabelSize, totalRowSize)

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
		totalLabelSize: number,
		totalRowSize: number
	) {
		const plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			//Note: ts is complaining absMax could be null. Ignore. Error in server request.
			domain: [data.absMin, data.absMax! <= 1 ? data.absMax : data.absMax! + 1],
			range: [0, settings.boxplotWidth],
			svg: this.setSvgDim(totalRowSize, totalLabelSize, settings, data),
			title: this.setTitleDim(config, totalLabelSize, settings),
			axis: {
				x: settings.isVertical ? this.topPad + this.incrPad : totalLabelSize,
				y: this.topPad + this.incrPad + 20 + (settings.isVertical ? settings.labelPad : 0)
			},
			backgroundColor: settings.darkMode ? 'black' : 'white',
			textColor: settings.darkMode ? 'white' : 'black'
		}
		return plotDim
	}

	setSvgDim(totalRowSize, totalLabelSize, settings, data) {
		const plotsSpace =
			data.plots.filter(p => !p.isHidden).length * totalRowSize + this.topPad + this.bottomPad + this.incrPad
		const depth = settings.boxplotWidth + totalLabelSize + this.horizPad
		return {
			width: settings.isVertical ? plotsSpace : depth,
			height: settings.isVertical ? depth : plotsSpace
		}
	}

	setTitleDim(config, totalLabelSize, settings) {
		const depth = totalLabelSize + settings.boxplotWidth / 2
		return {
			x: settings.isVertical ? this.topPad : depth,
			y: settings.isVertical ? depth - this.horizPad / 2 : this.topPad + this.incrPad / 2,
			text: config.term.q.mode == 'continuous' ? config.term.term.name : config.term2.term.name
		}
	}

	setPlotData(data: any, config: any, settings: BoxPlotSettings, totalLabelSize: number, totalRowSize: number) {
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
			plot.x = settings.isVertical ? this.topPad + this.incrPad : totalLabelSize
			plot.y = settings.isVertical
				? settings.boxplotWidth + settings.labelPad + this.bottomPad * 2
				: this.topPad + this.incrPad
			this.incrPad += totalRowSize
		}
		return plots
	}
}
