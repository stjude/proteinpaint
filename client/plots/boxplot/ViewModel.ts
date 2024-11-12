import type { BoxPlotSettings } from './BoxPlot'
import type { BoxPlotResponse, BoxPlotData, BoxPlotDescrStatsEntry } from '#types'

/**
 * Calculates the dimensions and html attributes for the svg and
 * individual boxplots. The data is passed to the View class.
 */

export type ViewData = {
	plotDim: PlotDimensions
	plots: Plots[]
	legend: { label: string; items: LegendItemEntry[] }[]
}

export type LegendItemEntry = {
	label: string
	/** Value for stat */
	value?: number
	/** Total number of samples, cells, etc. */
	count?: number
	/** If true, line-through text */
	isHidden: boolean
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
	incrTopPad = 40
	/** Range is 20 - 50 */
	rowHeight: number
	/** Range is 10 -20 */
	rowSpace: number
	viewData!: ViewData
	constructor(config: any, data: BoxPlotResponse, settings: BoxPlotSettings, maxLabelLgth: number) {
		/** As requested, adjust the size of each plot based on the number of boxplots
		 * Manages rendering very large svgs. */
		const numOfPlots = data.plots.filter(p => !p.uncomputable).length
		if (config.settings.boxplot.useDefaultSettings == true && numOfPlots > 10) {
			this.rowHeight = numOfPlots > 20 ? 20 : 35
			this.rowSpace = numOfPlots > 20 ? 10 : 12
		} else {
			this.rowHeight = settings.rowHeight
			this.rowSpace = settings.rowSpace
		}

		if (!data || !data.plots?.length) return

		const totalLabelWidth = maxLabelLgth + settings.labelPad
		const totalRowHeight = this.rowHeight + this.rowSpace

		const plotDim = this.setPlotDimensions(data, config, settings, totalLabelWidth, totalRowHeight)
		//20 for the yAxis offset (above), 10 more for the first boxplot
		this.incrTopPad += 30

		this.viewData = {
			plotDim: plotDim as PlotDimensions,
			plots: this.setPlotData(data, config, settings, totalLabelWidth, totalRowHeight),
			legend: this.setLegendData(config, data) || []
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
				data.plots.filter(p => !p.uncomputable).length * totalRowHeight +
				this.topPad +
				this.bottomPad +
				this.incrTopPad,
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
		return plotDim
	}

	setPlotData(data: any, config: any, settings: BoxPlotSettings, totalLabelWidth: number, totalRowHeight: number) {
		const plots = structuredClone(data.plots.filter(p => !p.uncomputable))
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
		const legendData: { label: string; items: LegendItemEntry[] }[] = []
		const isTerm2 = config?.term2 && config.term2.q?.descrStats
		if (config.term.q?.descrStats) {
			legendData.push({
				label: `Descriptive Statistics${isTerm2 ? `: ${config.term.term.name}` : ''}`,
				items: config.term.q.descrStats
			})
			if (isTerm2) {
				legendData.push({
					label: `Descriptive Statistics: ${config.term2.term.name}`,
					items: config.term2.q.descrStats
				})
			}
			const uncomputablePlots = data.plots
				.filter(p => p.uncomputable)
				?.map(p => {
					const total = p.descrStats.find(d => d.id === 'total')
					return { label: p.key, count: total!.value, isHidden: true }
				})
			if (config.term.term?.values) {
				const term1Label = config.term2 ? config.term.term.name : 'Other categories'
				const term1Data = this.setHiddenCategoryItems(
					config.term.term,
					term1Label,
					uncomputablePlots,
					data.uncomputableValues || undefined
				)
				if (term1Data) legendData.push(term1Data)
			}

			if (config.term2?.term?.values && uncomputablePlots.length) {
				//TODO: Only show items with plot data?
				const term2Data = this.setHiddenCategoryItems(config.term2.term, config.term2.term.name, uncomputablePlots)
				if (term2Data) legendData.push(term2Data)
			}
			return legendData
		}
	}

	setHiddenCategoryItems(
		term: any,
		label: string,
		uncomputablePlots: LegendItemEntry[],
		uncomputableValues?: { label: string; value: number }[]
	) {
		const termData: { label: string; items: LegendItemEntry[] } = { label, items: [] }

		for (const v of Object.values(term.values || {})) {
			const label = (v as { label: string }).label
			const plot = uncomputablePlots.find(p => p.label === label)
			if (plot) termData.items.push(plot)
			else if (uncomputableValues) {
				const uncomputableItem = uncomputableValues.find(u => u.label === label)
				if (uncomputableItem) {
					termData.items.push({ label: uncomputableItem.label, count: uncomputableItem.value, isHidden: true })
				}
			}
		}

		return termData.items.length ? termData : null
	}
}
