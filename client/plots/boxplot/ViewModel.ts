import type { BoxplotSettings } from './Boxplot'

export class ViewModel {
	/** Top padding for the svg */
	readonly topPad = 20
	/** Bottom padding for the svg */
	readonly bottomPad = 40
	/** Horizontal, or right and left padding */
	readonly horizPad = 100
	/** For outliers, set a radius rather than using the default. */
	readonly outRadius = 5
	constructor(config: any, data: any, settings: BoxplotSettings) {
		for (const plot of data.plots) {
			plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color
			if (plot.boxplot.out?.length) {
				const maxOut = plot.boxplot.out.reduce((a, b) => Math.max(a.value, b.value))
				if (maxOut && maxOut.value > data.absMax) data.absMax = maxOut.value
				plot.boxplot.radius = this.outRadius
			}
		}

		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 *
		 * maybe return as const? not in data?
		 */

		const totalLabelWidth = data.maxLabelLgth + settings.labelPad + this.horizPad
		const totalRowHeight = settings.rowHeight + settings.rowSpace

		data.plotDim = {
			svgWidth: settings.boxplotWidth + totalLabelWidth + this.horizPad,
			svgHeight: data.plots.length * totalRowHeight + this.topPad + this.bottomPad,
			totalLabelWidth,
			totalRowHeight,
			vertPad: this.topPad,
			horizPad: this.horizPad
		}
	}
}
