import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotConfig } from '../BoxPlotTypes'
import type { TdbBoxplot } from '../BoxPlot.ts'
import type { ViolinBoxResponse } from '#types'
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
		const data: ViolinBoxResponse = await this.app.vocabApi.getViolinBox(
			this.setRequestOpts(),
			{},
			this.boxplot.api.getAbortSignal()
		)
		return data
	}

	setRequestOpts() {
		const isNumericTC = this.config.term.term.type == 'termCollection' && this.config.term.term.memberType == 'numeric'
		const opts: { [index: string]: any } = {
			plotType: 'box',
			tw: this.getContinousTerm(),
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			orderByMedian: this.settings.orderByMedian,
			isLogScale: this.settings.isLogScale,
			removeOutliers: this.settings.removeOutliers,
			showAssocTests: this.settings.showAssocTests
		}
		// Server creates a synthetic overlay for numeric termCollection,
		// so don't send term2/term0 — they would be overwritten
		if (!isNumericTC) {
			if (this.config.term2)
				opts.overlayTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term
			if (this.config.term0) opts.divideTw = this.config.term0
		}

		return opts
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		// Numeric termCollection is always the primary continuous term
		if (this.config.term.term.type == 'termCollection' && this.config.term.term.memberType == 'numeric')
			return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}
}
