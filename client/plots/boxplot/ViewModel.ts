import type { BoxplotSettings } from './Boxplot'

export class ViewModel {
	config: any
	data: any
	settings: BoxplotSettings
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
		this.settings = settings
		this.config = config

		const viewData: any = structuredClone(data)

		const totalLabelWidth = viewData.maxLabelLgth + this.settings.labelPad + this.horizPad
		const totalRowHeight = this.settings.rowHeight + this.settings.rowSpace

		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 */

		viewData.plotDim = {
			incrTopPad: this.incrTopPad,
			svgWidth: this.settings.boxplotWidth + totalLabelWidth + this.horizPad,
			svgHeight: viewData.plots.length * totalRowHeight + this.topPad + this.bottomPad + this.incrTopPad,
			title: {
				x: totalLabelWidth + this.settings.boxplotWidth / 2,
				y: this.topPad + this.incrTopPad / 2
			},
			yAxis: {
				x: totalLabelWidth,
				y: this.topPad + this.incrTopPad + 20
			}
		}
		//20 for the yAxis offset, 10 more for the first boxplot
		this.incrTopPad += 30

		for (const plot of viewData.plots) {
			if (!plot.color) plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color
			if (plot.boxplot.out.length) {
				const maxOut = plot.boxplot.out.reduce((a, b) => Math.max(a.value, b.value))
				if (maxOut && maxOut.value > viewData.absMax) viewData.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
			plot.x = totalLabelWidth
			plot.y = this.topPad + this.incrTopPad
			this.incrTopPad += totalRowHeight
		}

		viewData.plotTitle = this.config.term.term.name

		return viewData
	}
}
