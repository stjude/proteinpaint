import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotConfig } from '../BoxPlotTypes'
import type { TdbBoxplot } from '../BoxPlot.ts'
import type { BoxPlotResponse } from '#types'
import { isNumericTerm } from '#shared/terms.js'
import type { BoxPlotSettings } from '../Settings.ts'

/**
 * Requests data for the boxplots.
 * Add more methods for formating the request opts and api requests.
 */
export class Model {
	boxplot: TdbBoxplot
	config: BoxPlotConfig
	state: MassState
	app: MassAppApi
	settings: BoxPlotSettings

	constructor(boxplot: TdbBoxplot, config: BoxPlotConfig) {
		this.boxplot = boxplot
		this.config = config
		this.state = boxplot.state
		this.app = boxplot.app
		this.settings = config.settings.boxplot
	}

	async getData() {
		const boxPlotDataArgs = this.setRequestOpts()
		const data: BoxPlotResponse = await this.app.vocabApi.getBoxPlotData(
			boxPlotDataArgs,
			this.boxplot.api.getAbortSignal()
		)
		return data
	}

	setRequestOpts() {
		const opts: { [index: string]: any } = {
			tw: this.getContinousTerm(),
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			orderByMedian: this.settings.orderByMedian,
			isLogScale: this.settings.isLogScale,
			removeOutliers: this.settings.removeOutliers,
			showAssocTests: this.settings.showAssocTests
		}
		if (this.config.term2)
			opts.overlayTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term

		if (this.config.term0) opts.divideTw = this.config.term0

		return opts
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}
}
