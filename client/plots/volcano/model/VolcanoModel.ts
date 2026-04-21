import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { DERequest, DiffMethRequest, TermdbSingleCellDEgenesRequest, VolcanoRenderRequest } from '#types'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { getGroupColors, toHex } from '../colors'

export class VolcanoModel {
	app: MassAppApi
	config!: any
	settings!: any
	termType: string

	constructor(app: MassAppApi, termType: string) {
		this.app = app
		this.termType = termType
	}

	/** May use mapper instead as more termTypes are added */
	async getData(config: any, settings: any) {
		this.config = config
		this.settings = settings

		if (this.termType === GENE_EXPRESSION) {
			const body = await this.getGERequestBody()
			return await dofetch3('termdb/DE', { body })
		}
		if (this.termType === DNA_METHYLATION) {
			const body = await this.getDMRequestBody()
			return await dofetch3('termdb/diffMeth', { body })
		}
		if (this.termType === SINGLECELL_CELLTYPE) {
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
			cpm_cutoff: this.settings.cpmCutoff,
			volcanoRender: this.getVolcanoRender()
		} as Partial<DERequest> //remove Partial when storage_type is removed from DERequest

		this.addConfounderTw(body)

		return body
	}

	//DNA methylation
	async getDMRequestBody() {
		await this.getOtherSamples(this.config.samplelst)
		const state = this.app.getState()
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			samplelst: this.config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			min_samples_per_group: this.settings.minSamplesPerGroup,
			volcanoRender: this.getVolcanoRender()
		} as Partial<DiffMethRequest>

		this.addConfounderTw(body)

		return body
	}

	/** Parameters telling the server to run the `volcano` Rust renderer and return a
	 * volcano PNG + top-significant rows instead of the full dot list. */
	getVolcanoRender(): VolcanoRenderRequest {
		// Match the client overlay's radius (see VolcanoViewModel.setPointData)
		// so the PNG rings and the interactive overlay rings line up; otherwise
		// a smaller PNG ring sits inside the larger overlay ring and looks like
		// a stray dot at the center.
		const dotRadius = Math.max(this.settings.width, this.settings.height) / 80
		// Resolve case/control colors via the shared helper (see colors.ts) so the
		// PNG and the SVG overlay paint each side with the exact same hex string.
		const { caseColor, controlColor } = getGroupColors(this.config)
		return {
			significanceThresholds: {
				pValueCutoff: this.settings.pValue,
				pValueType: this.settings.pValueType,
				foldChangeCutoff: this.settings.foldChangeCutoff
			},
			pixelWidth: this.settings.width,
			pixelHeight: this.settings.height,
			colorSignificant: toHex(this.settings.defaultSignColor, 'red'),
			colorSignificantUp: caseColor,
			colorSignificantDown: controlColor,
			colorNonsignificant: toHex(this.settings.defaultNonSignColor, 'black'),
			dotRadius,
			maxInteractiveDots: this.settings.maxInteractiveDots
		}
	}

	//This is a workaround until the server can accept an arr of confounder tws
	addConfounderTw(body) {
		const confounders = this.config?.confounderTws
		if (confounders?.length) {
			body.tw = this.config.confounderTws[0]
			if (confounders.length > 1) body.tw2 = this.config.confounderTws[1]
		}
	}

	//Single cell cell type
	getSCCTRequestBody(): TermdbSingleCellDEgenesRequest {
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			sample: this.config.sample,
			termId: this.config.termId,
			categoryName: this.config.categoryName,
			volcanoRender: this.getVolcanoRender()
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
