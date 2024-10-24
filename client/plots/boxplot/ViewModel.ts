import type { BoxplotSettings } from './Boxplot'

export class ViewModel {
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

		const totalLabelWidth = data.maxLabelLgth + settings.labelPad
		const totalRowHeight = settings.rowHeight + settings.rowSpace

		/** Add more plot dimensions here
		 * Eventually should calculate the difference between vertical and
		 * horizontal orientation.
		 */
		data.plotDim = {
			svgWidth: settings.boxplotWidth + totalLabelWidth,
			svgHeight: data.plots.length * totalRowHeight,
			totalLabelWidth,
			totalRowHeight
		}
	}
}
