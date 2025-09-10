import { format } from 'd3-format'
import { decimalPlacesUntilFirstNonZero } from '#shared/roundValue.js'
import { rgb } from 'd3-color'
import type { BoxPlotChartEntry } from '#types'
import type { BoxPlotSettings, PlotDimensions, ViewData, BoxPlotConfig } from '../BoxPlotTypes'
import { LegendDataMapper } from './LegendDataMapper'

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
	/** Total size of the labels. May reflect height or width depending on orientation */
	private totalLabelSize: number
	/** Total size of each box plot. May reflect height or width depending on orientation */
	private totalRowSize: number
	viewData: ViewData
	constructor(
		config: BoxPlotConfig,
		data: BoxPlotChartEntry,
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

		this.totalLabelSize = maxLabelLgth + settings.labelPad
		this.totalRowSize = this.rowHeight + this.rowSpace

		const plotDim = this.setPlotDimensions(data, config, settings)
		//20 for the axis offset (above), 10 more for the first boxplot
		this.incrPad += 30

		const plots = this.setPlotData(data, config, settings)

		this.viewData = {
			plotDim: plotDim as PlotDimensions,
			plots: plots.filter(p => !p.isHidden),
			legend: new LegendDataMapper(config, data, plots).legendData
		}
	}

	setPlotDimensions(data: BoxPlotChartEntry, config: any, settings: BoxPlotSettings) {
		const svg = this.setSvgDimensions(settings, data)
		const plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			//Note: ts is complaining absMax could be null. Ignore. Error in server request.
			domain: [data.absMin, data.absMax! <= 1 ? data.absMax : data.absMax! + 1],
			range: [0, settings.boxplotWidth],
			svg,
			chartTitle: getChartTitle(config, data.chartId),
			title: this.setTitleDimensions(config, settings, svg.height),
			axis: {
				x: settings.isVertical ? this.horizPad / 2 + this.incrPad + this.topPad : this.totalLabelSize,
				y: this.topPad + (settings.isVertical ? settings.labelPad : this.incrPad + 20),
				values: (ticks: number[]) => {
					if (settings.isLogScale) return this.filterTickValues(ticks)
					return ticks
				},
				format: (d: number) => {
					if (settings.isLogScale) {
						if (Number.isInteger(d)) return format('.0f')(d)
						const dec = decimalPlacesUntilFirstNonZero(d)
						if (dec > 1) return format(`.${dec + 1}f`)(d)
						return format('.2f')(d)
					}
					return d.toString()
				}
			},
			backgroundColor: settings.displayMode == 'dark' ? 'black' : 'white',
			textColor: settings.displayMode == 'dark' ? 'white' : 'black'
		}
		return plotDim
	}

	filterTickValues(ticks: number[]) {
		const signifcantLessThanOne = ticks.filter(t => t < 1).length / ticks.length
		const range = ticks[ticks.length - 1] - ticks[0]
		const spread = range > 1000 ? 4 : range > 100 ? 3 : 2
		const formattedTicks = ticks.filter((t, i) => {
			if (t === 0 || (i == ticks.length - 1 && i % spread !== 0)) return t
			else if (t <= 1 && signifcantLessThanOne > 0.5) {
				/** Scales with a significant number of values under 1
				 * require more space. Show every fifth value if under 1 */
				if (i % 5 === 0) return t
			} else if (i % spread === 0) return t
		})
		return formattedTicks
	}

	setSvgDimensions(settings: BoxPlotSettings, data: BoxPlotChartEntry) {
		const plotsSpace =
			data.plots.filter(p => !p.isHidden).length * this.totalRowSize + this.topPad + this.bottomPad + this.incrPad
		const depth = settings.boxplotWidth + this.totalLabelSize + this.horizPad / 2
		return {
			width: settings.isVertical ? plotsSpace + this.horizPad : depth,
			height: settings.isVertical ? depth : plotsSpace
		}
	}

	setTitleDimensions(config: any, settings: BoxPlotSettings, height: number) {
		const depth = this.totalLabelSize + settings.boxplotWidth / 2
		return {
			x: settings.isVertical ? this.horizPad / 2 : depth,
			y: settings.isVertical ? height - depth - this.horizPad / 2 : this.topPad + this.incrPad / 2,
			text: config.term.q.mode == 'continuous' ? config.term.term.name : config.term2.term.name
		}
	}

	setPlotData(data: any, config: any, settings: BoxPlotSettings) {
		const plots = structuredClone(data.plots)
		for (const plot of plots) {
			/** Set rendering properties for the plot */

			//Set the color for all plots
			const color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color
			if (!plot.color) plot.color = color
			//Brighten the colors in dark mode for better visibility
			if (settings.displayMode == 'dark') plot.color = rgb(plot.color).brighter(0.75)
			//Ignore if hidden after the color is set
			if (plot.isHidden) continue
			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a: { value: number }, b: { value: number }) =>
					Math.max(a.value, b.value)
				)
				if (maxOut && maxOut.value > data.absMax) data.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
			plot.labColor = settings.displayMode == 'dark' ? 'white' : 'black'
			plot.boxplot.rectFill =
				settings.displayMode == 'dark' ? 'black' : settings.displayMode == 'filled' ? color : 'white'
			plot.x = settings.isVertical ? this.horizPad / 2 + this.incrPad : this.totalLabelSize
			plot.y = this.topPad + (settings.isVertical ? settings.boxplotWidth + settings.labelPad : this.incrPad)
			this.incrPad += this.totalRowSize
		}
		return plots
	}
}

export function getChartTitle(config, chartId) {
	if (!config.term0) return chartId
	return config.term0.term.values && chartId in config.term0.term.values
		? config.term0.term.values[chartId].label
		: chartId
}
