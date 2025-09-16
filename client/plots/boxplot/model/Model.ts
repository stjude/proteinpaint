import type { MassAppApi } from '#mass/types/mass'
import type { BoxPlotSettings, BoxPlotConfig } from '../BoxPlotTypes'
import type { BoxPlotResponse } from '#types'
import type { MassState } from '#mass/types/mass'
import { isNumericTerm } from '#shared/terms.js'

/**
 * Requests data for the boxplots.
 * Add more methods for formating the request opts and api requests.
 */
export class Model {
	config: BoxPlotConfig
	state: MassState
	app: MassAppApi
	settings: BoxPlotSettings
	constructor(config: BoxPlotConfig, state: MassState, app: MassAppApi, settings: BoxPlotSettings) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
	}

	async getData() {
		await this.getDescrStats()
		const boxPlotDataArgs = this.setRequestOpts()
		const data: BoxPlotResponse = await this.app.vocabApi.getBoxPlotData(boxPlotDataArgs)
		return data
	}

	setRequestOpts() {
		const opts: { [index: string]: any } = {
			tw: this.getContinousTerm(),
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0
		}
		if (this.config.term2)
			opts.overlayTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term

		if (this.config.term0) opts.divideTw = this.config.term0

		opts.orderByMedian = this.settings.orderByMedian
		opts.isLogScale = this.settings.isLogScale
		opts.removeOutliers = this.settings.removeOutliers
		return opts
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}

	//Consider consolidating this fn with identical fn in
	//barchart and violin
	async getDescrStats() {
		//Requests desc stats for all values for each term
		const terms = [this.config.term]
		if (this.config.term2) terms.push(this.config.term2)
		if (this.config.term0) terms.push(this.config.term0)
		for (const t of terms) {
			if (isNumericTerm(t.term)) {
				const data = await this.app.vocabApi.getDescrStats(t, this.state.termfilter, true)
				if (data.error) {
					if (data.error instanceof Error) console.error(data.error)
					throw data.error
				}
				t.q.descrStats = data.values
			}
		}
	}
}
