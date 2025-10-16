import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { VolcanoPlotConfig, VolcanoSettings } from '../VolcanoTypes'

export class VolcanoModel {
	app: MassAppApi
	config: VolcanoPlotConfig
	settings: VolcanoSettings
	termType: string
	constructor(app: MassAppApi, config: VolcanoPlotConfig, settings: VolcanoSettings) {
		this.app = app
		this.config = config
		this.settings = settings
		this.termType = config.termType
	}

	/** May use mapper instead as more termTypes are added */
	async getData() {
		if (this.termType === 'geneExpression') {
			const body = await this.getGERequestBody()
			const data = await dofetch3('DEanalysis', { body })
			return data
		}
		if (this.termType === 'singleCellCellType') {
			//TODO: will add method for sc cell type
		}
	}

	async getGERequestBody() {
		await this.getOtherSamples(this.config.samplelst)
		const state = this.app.getState()
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			method: this.settings.method,
			min_count: this.settings.minCount,
			min_total_count: this.settings.minTotalCount,
			samplelst: this.config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			cpm_cutoff: this.settings.cpmCutoff
		} as any
		//This is a workaround until the server can accept an arr of confounder tws
		const confounders = this.config?.confounderTws
		if (confounders?.length) {
			body.tw = this.config.confounderTws[0]
			if (confounders.length > 1) body.tw2 = this.config.confounderTws[1]
		}

		return body
	}

	/** retrieve the sampleId/sampleName for samples in the "others" group instead of using {in: false} */
	async getOtherSamples(samplelst) {
		const othersSamplesGroup = samplelst.groups.find(g => !g.in)
		if (!othersSamplesGroup) return

		const state = this.app.getState()
		const samplesGroup = samplelst.groups.find(g => g.in)
		othersSamplesGroup.values = []
		// retrieve full list of samples based on current filter. put samples not in samplesGroup in "others" group
		for (const s of await this.app.vocabApi.getFilteredSampleList(state.termfilter.filter)) {
			// s={id,name}, samplelst.groups[].values[]={sampleId,sample}
			if (samplesGroup.values.indexOf(i => i.sampleId == s.id) == -1) {
				othersSamplesGroup.values.push({ sampleId: s.id, sample: s.name })
			}
		}
		othersSamplesGroup.in = true
	}
}
