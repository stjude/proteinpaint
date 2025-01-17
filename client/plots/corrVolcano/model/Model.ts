import type { MassAppApi, MassState } from '#mass/types/mass'
import type { CorrVolcanoPlotConfig } from '../CorrelationVolcano'
import { fillTermWrapper } from '#termsetting'

export class Model {
	config: CorrVolcanoPlotConfig
	state: MassState
	app: MassAppApi
	dsCorrVolcanoSettings: any
	constructor(config: CorrVolcanoPlotConfig, state: MassState, app: MassAppApi, dsCorrVolcanoSettings: any) {
		this.config = config
		this.state = state
		this.app = app
		this.dsCorrVolcanoSettings = dsCorrVolcanoSettings
	}

	async getData() {
		const data = await this.app.vocabApi.getCorrelationVolcanoData(this.setRequestOpts())
		return data
	}

	setRequestOpts() {
		//Quick fix
		const variableTwLst = this.dsCorrVolcanoSettings.variables.termIds.map((id: string) => {
			return { term: { id } }
		})
		for (const t of variableTwLst) fillTermWrapper(t, this.app.vocabApi)
		return {
			featureTw: this.config.featureTw,
			variableTwLst,
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0
		}
	}
}
