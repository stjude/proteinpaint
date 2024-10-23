import type { BoxplotSettings } from './Boxplot'

export class ViewModel {
	constructor(config: any, data: any, settings: BoxplotSettings) {
		for (const plot of data.plots) {
			plot.color = config?.term2?.term?.values?.[plot.seriesId]?.color || settings.color
		}

		data.plotDim = {
			totalRowHeight: settings.rowHeight + settings.rowSpace
		}
	}
}
