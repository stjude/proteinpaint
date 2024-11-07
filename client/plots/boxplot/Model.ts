import type { MassAppApi } from '../../mass/types/mass'
import type { BoxPlotSettings } from './BoxPlot'
import { isNumericTerm } from '#shared/terms.js'

/**
 * Requests data for the boxplots.
 * Add more methods for formating the request opts and api requests.
 */
export class Model {
	config: any
	state: any
	app: MassAppApi
	settings: BoxPlotSettings
	constructor(config: any, state: any, app: MassAppApi, settings: BoxPlotSettings) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
	}

	async getData() {
		const boxPlotDataArgs = this.setRequestOpts()

		const data = await this.app.vocabApi.getBoxPlotData(boxPlotDataArgs)
		return data
	}

	setRequestOpts() {
		const opts: { [index: string]: any } = {
			tw: this.getContinousTerm(),
			filter: this.state.termfilter.filter
		}
		if (this.config.term2)
			opts.divideTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term

		return opts
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}
}
