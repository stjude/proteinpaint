import type { MassAppApi } from '../../mass/types/mass'
import type { BoxplotSettings } from './Boxplot'

export class Model {
	config: any
	state: any
	app: MassAppApi
	settings: BoxplotSettings
	constructor(config, state, app, settings) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
	}

	async getData() {
		const boxPlotDataArgs: any = {
			tw: this.config.term,
			filter: this.state.termfilter.filter
		}
		if (this.config.term2) boxPlotDataArgs.divideTw = this.config.term2

		const data = await this.app.vocabApi.getBoxPlotData(boxPlotDataArgs)
		this.processPlotsData(data.plots)
		return data
	}

	processPlotsData(plots) {
		for (const plot of plots) {
			plot.boxplot.label = plot.label
			plot.color = this.config?.term2?.term?.values?.[plot.seriesId]?.color || this.settings.color
		}
	}
}
