import { format } from 'd3-format'
import { decimalPlacesUntilFirstNonZero } from '#shared/roundValue.js'
import { rgb } from 'd3-color'
import type { BoxPlotChartEntry } from '#types'
import type { BoxPlotSettings } from '../Settings'
import type { BoxPlotConfig } from '../BoxPlotTypes'

/** Formats the .charts{} response data for rendering
 * in the View -> ChartRender. */
export class ChartsDataMapper {
	/** Top padding for the svg */
	#topPad = 20
	/** Bottom padding for the svg */
	#bottomPad = 25
	/** Horizontal, or right and left padding */
	#horizPad = 120
	/** For outliers, set a radius rather than using the default. */
	#outRadius = 5
	/** Offset applied when divide by term is present
	 * Creates space for the subtitle*/
	#divideByOffset = 20

	/** Max value from server response */
	absMax: number
	/** Min value from server response */
	absMin: number
	/** Array of charts from server response */
	charts: BoxPlotChartEntry[]
	/** Range is 20 - 50 */
	rowHeight: number
	/** Range is 10 - 20 */
	rowSpace: number
	/** Settings from the user or default */
	settings: any
	/** Total length of the labels. May reflect height or width depending on orientation */
	totalLabelSize: number
	/** Total size (ie. thickness) of each box plot. May reflect height or width depending on orientation */
	totalBoxSize: number

	constructor(data: any, settings: any, maxLabelLgth: number, useDefaultSettings: boolean) {
		this.validateInputData(data)

		this.absMin = data.absMin
		this.absMax = data.absMax
		this.charts = Object.values(data.charts)
		this.settings = settings

		/** As requested, adjust the size of each plot based
		 * on the number of boxplots. Manages rendering very large svgs.
		 * When the user sets the height or space, use those values
		 * for all further rendering. */
		if (useDefaultSettings) {
			const { rowHeight, rowSpace } = this.getRowSettings(this.charts)
			this.rowHeight = rowHeight
			this.rowSpace = rowSpace
		} else {
			this.rowHeight = settings.rowHeight
			this.rowSpace = settings.rowSpace
		}

		this.totalLabelSize = maxLabelLgth + settings.labelPad
		this.totalBoxSize = this.rowHeight + this.rowSpace
	}

	/** Same checks are in the server route */
	validateInputData(data: any) {
		if (!data) throw new Error('No data provided to ChartDataMapper')
		if (!data.charts) throw new Error('No charts data provided to ChartDataMapper')
		if (!Array.isArray(data.charts) && typeof data.charts !== 'object')
			throw new Error('Invalid charts data provided to ChartDataMapper')
		if (data.absMin === undefined || data.absMax === undefined)
			throw new Error('Missing absMin or absMax in data provided to ChartDataMapper')
	}

	/** Set the row settings based on all plots */
	getRowSettings(charts: BoxPlotChartEntry[]) {
		let totalNumPlots = 0
		for (const chart of charts) {
			totalNumPlots = totalNumPlots + chart.plots.filter(p => !p.isHidden).length
		}
		const isLargePlotCount = totalNumPlots > 20
		const rowHeight = totalNumPlots > 10 ? (isLargePlotCount ? 20 : 35) : 50
		const rowSpace = totalNumPlots > 10 ? (isLargePlotCount ? 10 : 12) : 15

		return { rowHeight, rowSpace }
	}

	map(config: BoxPlotConfig) {
		const chartData = {}
		for (const chart of this.charts) {
			/** Increasing padding to space out the boxplots and determine position */
			let incrPad = 40

			const plotDim = this.setPlotDimensions(chart, config, this.settings, incrPad)
			//Include extra space for the subtitle
			if (config?.term0) incrPad += this.#divideByOffset
			//20 for the axis offset (above), 10 more for the first boxplot
			incrPad += 30

			chartData[chart.chartId] = {
				plotDim: plotDim,
				plots: this.setPlotData(chart, config, this.settings, incrPad),
				wilcoxon: chart?.wilcoxon || null
			}
		}
		return chartData
	}

	setPlotDimensions(chart: BoxPlotChartEntry, config: any, settings: BoxPlotSettings, incrPad: number) {
		const svg = this.setSvgDimensions(settings, chart, incrPad, config)
		const plotCenter = this.totalLabelSize + settings.plotLength / 2
		const plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			domain: [this.absMin, this.absMax <= 1 ? this.absMax : this.absMax + 1],
			range: [0, settings.plotLength],
			svg,
			subtitle: this.setSubtitleDimensions(
				config,
				settings,
				svg.height,
				chart.chartId,
				chart.sampleCount,
				plotCenter,
				incrPad
			),
			title: this.setTitleDimensions(config, settings, svg.height, plotCenter, incrPad),
			axis: {
				x: settings.isVertical ? this.#horizPad / 2 + incrPad + this.#topPad : this.totalLabelSize,
				y: this.#topPad + (settings.isVertical ? settings.labelPad : incrPad + 20),
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
			}
		}

		if (config?.term0) {
			if (settings.isVertical) plotDim.axis.x += this.#divideByOffset
			else plotDim.axis.y += this.#divideByOffset
		}

		return plotDim
	}

	setSvgDimensions(
		settings: BoxPlotSettings,
		chart: BoxPlotChartEntry,
		incrPad: number,
		config: any
	): { width: number; height: number } {
		let plotsSpace =
			chart.plots.filter(p => !p.isHidden).length * this.totalBoxSize + this.#topPad + this.#bottomPad + incrPad
		if (config?.term0) plotsSpace += this.#divideByOffset + incrPad

		const length = settings.plotLength + this.totalLabelSize + this.#horizPad / 2
		return {
			width: settings.isVertical ? plotsSpace + this.#horizPad : length,
			height: settings.isVertical ? length : plotsSpace
		}
	}

	setSubtitleDimensions(
		config: any,
		settings: BoxPlotSettings,
		height: number,
		chartId: string,
		sampleCount: number,
		plotCenter: number,
		incrPad: number
	): { x: number | null; y: number | null; text: string | null } {
		const dim: { x: number | null; y: number | null; text: string | null } = {
			x: null,
			y: null,
			text: null
		}
		if (config.term0) {
			dim.x = settings.isVertical ? this.#horizPad / 2 : plotCenter
			dim.y = settings.isVertical ? height - plotCenter - this.#horizPad / 2 : this.#topPad + incrPad / 2
			dim.text = `${getChartSubtitle(config, chartId)} (n=${sampleCount})`
		}
		return dim
	}

	setTitleDimensions(config: any, settings: BoxPlotSettings, height: number, plotCenter: number, incrPad: number) {
		const dim = {
			x: settings.isVertical ? this.#horizPad / 2 : plotCenter,
			y: settings.isVertical ? height - plotCenter - this.#horizPad / 2 : this.#topPad + incrPad / 2,
			text: config.term.q.mode == 'continuous' ? config.term.term.name : config.term2.term.name
		}
		if (config?.term0) {
			if (settings.isVertical) dim.x += this.#divideByOffset + 10
			else dim.y += this.#divideByOffset + 10
		}
		return dim
	}

	filterTickValues(ticks: number[]) {
		if (!ticks || ticks.length == 0) {
			throw new Error('No ticks provided to filterTickValues')
		}
		const significantLessThanOne = ticks.filter(t => t < 1).length / ticks.length
		const range = ticks[ticks.length - 1] - ticks[0]
		const spread = range > 1000 ? 4 : range > 100 ? 3 : 2
		const formattedTicks = ticks.filter((t, i) => {
			if (t === 0 || (i == ticks.length - 1 && i % spread !== 0)) return t
			else if (t <= 1 && significantLessThanOne > 0.5) {
				/** Scales with a significant number of values under 1
				 * require more space. Show every fifth value if under 1 */
				if (i % 5 === 0) return t
			} else if (i % spread === 0) return t
		})
		return formattedTicks
	}

	setPlotData(chart: any, config: any, settings: BoxPlotSettings, incrPad: number) {
		const plots = structuredClone(chart.plots.filter(p => !p.isHidden))
		for (const plot of plots) {
			/** Set rendering properties for the plot */

			//Set the color for all plots
			let color
			const term2 = config.term2
			if (term2) {
				if (term2.q.type == 'predefined-groupset' || term2.q.type == 'custom-groupset') {
					const groupset =
						term2.q.type == 'predefined-groupset'
							? term2.term.groupsetting.lst[term2.q.predefined_groupset_idx]
							: term2.q.customset
					if (!groupset) throw 'groupset is missing'
					const group = groupset.groups.find(g => g.name == plot.seriesId)
					if (group?.color) color = group.color
				} else {
					color = term2.term.values?.[plot.seriesId]?.color
				}
			}
			if (!color) color = settings.color

			if (!plot.color) plot.color = color
			//Brighten the colors in dark mode for better visibility
			if (settings.displayMode == 'dark') plot.color = rgb(plot.color).brighter(0.75)
			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a: { value: number }, b: { value: number }) =>
					Math.max(a.value, b.value)
				)
				if (maxOut && maxOut.value > chart.absMax) chart.absMax = maxOut.value
				plot.boxplot.radius = this.#outRadius
			}
			plot.boxplot.rectFill =
				settings.displayMode == 'dark' ? 'black' : settings.displayMode == 'filled' ? color : 'white'
			plot.x = settings.isVertical ? this.#horizPad / 2 + incrPad : this.totalLabelSize
			plot.y = this.#topPad + (settings.isVertical ? settings.plotLength + settings.labelPad : incrPad)
			incrPad += this.totalBoxSize

			//Use for data requests in interactions
			plot.chartId = chart.chartId || ' '
		}
		return plots
	}
}

export function getChartSubtitle(config: any, chartId: string): string {
	if (!config.term0) return chartId
	return config.term0.term.values && chartId in config.term0.term.values
		? config.term0.term.values[chartId].label
		: chartId
}
