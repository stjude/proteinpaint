import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { VolcanoPlotConfig } from '../VolcanoTypes'
import type { DERequest, TermdbSingleCellDEgenesRequest } from '#types'
import { TermTypes } from '#shared/terms.js'
import type { ValidatedVolcanoSettings } from '../settings/Settings'

export class VolcanoModel {
	app: MassAppApi
	config: any
	settings: any
	termType: string

	constructor(app: MassAppApi, config: VolcanoPlotConfig, settings: ValidatedVolcanoSettings) {
		this.app = app
		this.config = config
		this.settings = settings
		this.termType = config.termType
	}

	/** May use mapper instead as more termTypes are added */
	async getData() {
		if (this.termType === TermTypes.GENE_EXPRESSION) {
			const body = await this.getGERequestBody()
			return await dofetch3('termdb/DE', { body })
		}
		if (this.termType === TermTypes.SINGLECELL_CELLTYPE) {
			const body = await this.getSCCTRequestBody()
			return await dofetch3('termdb/singlecellDEgenes', { body })
		} else {
			throw new Error(`Volcano plot does not support route for termType='${this.termType}'`)
		}
	}

	//Gene expression
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
		} as Partial<DERequest> //remove Partial when storage_type is removed from DERequest
		//This is a workaround until the server can accept an arr of confounder tws
		const confounders = this.config?.confounderTws
		if (confounders?.length) {
			body.tw = this.config.confounderTws[0]
			if (confounders.length > 1) body.tw2 = this.config.confounderTws[1]
		}

		return body
	}

	//Single cell cell type
	getSCCTRequestBody(): TermdbSingleCellDEgenesRequest {
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			sample: this.config.sample,
			columnName: this.config.columnName,
			categoryName: this.config.categoryName
		}
		return body
	}

	/** retrieve the sampleId/sampleName for samples in
	 * the "others" group instead of using {in: false} */
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
