import type { MassAppApi, MassState } from '#mass/types/mass'
import type { CorrVolcanoPlotConfig, CorrVolcanoSettings } from '../CorrelationVolcano'
import { fillTermWrapper } from '#termsetting'

export class Model {
	config: CorrVolcanoPlotConfig
	state: MassState
	app: MassAppApi
	settings: CorrVolcanoSettings
	dsCorrVolcanoSettings: any
	constructor(
		config: CorrVolcanoPlotConfig,
		state: MassState,
		app: MassAppApi,
		settings: CorrVolcanoSettings,
		dsCorrVolcanoSettings: any
	) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
		this.dsCorrVolcanoSettings = dsCorrVolcanoSettings
	}

	async getData() {
		const opts = await this.setRequestOpts()
		const data = await this.app.vocabApi.getCorrelationVolcanoData(opts)
		return data
	}

	async setRequestOpts() {
		const variableTwLst = this.dsCorrVolcanoSettings.variables.termIds.map((id: string) => {
			return { id }
		})
		for (const t of variableTwLst) await fillTermWrapper(t, this.app.vocabApi)
		return {
			featureTw: this.config.featureTw,
			variableTwLst,
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			correlationMethod: this.dsCorrVolcanoSettings.method
		}
	}
}
