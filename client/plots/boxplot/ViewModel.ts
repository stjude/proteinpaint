import type { BoxplotSettings } from './Boxplot'

/**
 * Calculates the dimensions and html attributes for the svg and
 * individual boxplots. The data is passed to the View class.
 *
 * TODO:
 *  Calculate the space needed for the labels rather than hardcoding with padding
 */

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
	constructor(config: any, data: any, settings: BoxplotSettings) {
		if (!data || !data.plots.length) return
		const viewData: any = structuredClone(data)

		const totalLabelWidth = viewData.maxLabelLgth * 4 + settings.labelPad + this.horizPad
		const totalRowHeight = settings.rowHeight + settings.rowSpace

		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 */

		viewData.plotDim = {
			//Add 1 to the max is big enough so the upper line to boxplot isn't cutoff
			domain: [viewData.absMin, viewData.absMax <= 1 ? viewData.absMax : viewData.absMax + 1],
			svgWidth: settings.boxplotWidth + totalLabelWidth + this.horizPad,
			svgHeight: viewData.plots.length * totalRowHeight + this.topPad + this.bottomPad + this.incrTopPad,
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

		for (const plot of viewData.plots) {
			if (!plot.color) plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color

			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a: { value: number }, b: { value: number }) =>
					Math.max(a.value, b.value)
				)
				if (maxOut && maxOut.value > viewData.absMax) viewData.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
			plot.x = totalLabelWidth
			plot.y = this.topPad + this.incrTopPad
			this.incrTopPad += totalRowHeight
		}

		return viewData
	}
}
