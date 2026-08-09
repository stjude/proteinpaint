import type { TermWrapper } from '#types'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { CorrVolcanoPlotConfig, CorrVolcanoSettings } from '../CorrelationVolcanoTypes'

export class Model {
	config: CorrVolcanoPlotConfig
	state: MassState
	app: MassAppApi
	settings: CorrVolcanoSettings
	variableTwLst: TermWrapper[]
	/** the plot-scoped vocabApi from PlotBase, so that an unrelated app dispatch does not cancel this request */
	vocabApi: any
	constructor(
		config: CorrVolcanoPlotConfig,
		state: MassState,
		app: MassAppApi,
		settings: CorrVolcanoSettings,
		variableTwLst: TermWrapper[],
		vocabApi: any
	) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
		this.variableTwLst = variableTwLst
		this.vocabApi = vocabApi
	}

	async getData() {
		const opts = await this.setRequestOpts()
		const data = await this.vocabApi.getCorrelationVolcanoData(opts)
		return data
	}

	async setRequestOpts() {
		return {
			featureTw: this.config.featureTw,
			variableTwLst: this.variableTwLst,
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			correlationMethod: this.settings.method
		}
	}
}
