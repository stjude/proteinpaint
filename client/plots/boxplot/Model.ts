import type { MassAppApi } from '../../mass/types/mass'
import type { BoxplotSettings } from './Boxplot'

/**
 * Requests data for the boxplots.
 * Add more methods for formating the request opts and api requests.
 */
export class Model {
	config: any
	state: any
	app: MassAppApi
	settings: BoxplotSettings
	constructor(config: any, state: any, app: MassAppApi, settings: BoxplotSettings) {
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
		return data
	}
}
