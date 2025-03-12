import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { VolcanoPlotConfig, VolcanoSettings } from '../VolcanoTypes'

export class VolcanoModel {
	app: MassAppApi
	config: VolcanoPlotConfig
	settings: VolcanoSettings
	constructor(app: MassAppApi, config: VolcanoPlotConfig, settings: VolcanoSettings) {
		this.app = app
		this.config = config
		this.settings = settings
	}

	async getData() {
		const body = this.getRequestBody()
		const data = await dofetch3('DEanalysis', { body })
		return data
	}

	getRequestBody() {
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			method: 'edgeR', //Eventually this can be removed from the backend code since wilcoxon is no longer needed.
			min_count: this.settings.minCount,
			min_total_count: this.settings.minTotalCount,
			samplelst: this.config.samplelst
		} as any
		//This is a workaround until the server can accept an arr of confounder tws
		const confounders = this.config.confounderTws
		if (confounders?.length) {
			body.tw = this.config.confounderTws[0]
			if (confounders.length > 1) body.tw2 = this.config.confounderTws[1]
		}

		return body
	}
}
