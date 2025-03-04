import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { DiffAnalysisPlotConfig, VolcanoSettings } from '../DiffAnalysisTypes'

export class VolcanoModel {
	app: MassAppApi
	config: DiffAnalysisPlotConfig
	settings: VolcanoSettings
	constructor(app: MassAppApi, config: DiffAnalysisPlotConfig, settings: VolcanoSettings) {
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
			samplelst: this.config.samplelst,
			VarGenes: this.settings.varGenesCutoff
		}

		return body
	}
}
