import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { VolcanoPlotConfig } from '../VolcanoTypes'
import type {
	DERequest,
	DiffMethRequest,
	TermdbSingleCellDEgenesRequest,
	VolcanoPlotRequest,
	VolcanoPlotResponse
} from '#types'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import type { ValidatedVolcanoSettings } from '../settings/Settings'
import { rgb } from 'd3-color'

/** Convert any CSS color string (e.g. "red", "rgb(255,0,0)") to "#rrggbb".
 *  The Rust renderer only understands hex. */
function toHex(color: string): string {
	try {
		return rgb(color).formatHex()
	} catch {
		return '#888888'
	}
}

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

	/** Call the server-side volcano renderer with the analysis response and
	 *  receive a base64 PNG plus the top-N interactive points. */
	async renderPlot(response: any): Promise<VolcanoPlotResponse> {
		const points = response.data.map((d: any) => ({
			gene: d.gene_name || d.promoter_id || d.gene_id || '',
			log2_fold_change: d.fold_change,
			original_p_value: d.original_p_value,
			adjusted_p_value: d.adjusted_p_value,
			promoter_id: d.promoter_id
		}))

		// Resolve up/down significant colors the same way VolcanoViewModel does:
		// prefer per-group colors from the term wrapper, else fall back to the
		// single defaultSignColor. See VolcanoViewModel constructor.
		// Match VolcanoViewModel constructor: controlColor (down) defaults to
		// 'red', caseColor (up) defaults to 'blue'.
		const groups = this.config?.samplelst?.groups
		const controlColor = this.config?.tw?.term?.values?.[groups?.[0]?.name]?.color || 'red'
		const caseColor = this.config?.tw?.term?.values?.[groups?.[1]?.name]?.color || 'blue'
		const upColor = caseColor
		const downColor = controlColor

		const body: VolcanoPlotRequest = {
			points,
			width: this.settings.width,
			height: this.settings.height,
			devicePixelRatio: window.devicePixelRatio || 1,
			pngDotRadius: Math.max(2, Math.round(Math.max(this.settings.width, this.settings.height) / 80)),
			foldChangeCutoff: this.settings.foldChangeCutoff,
			pValueCutoff: this.settings.pValue,
			pValueType: this.settings.pValueType,
			topN: this.settings.topInteractivePoints ?? 5000,
			colorSignificantUp: toHex(upColor),
			colorSignificantDown: toHex(downColor),
			colorNonsignificant: toHex(this.settings.defaultNonSignColor || 'black')
		}

		return await dofetch3('termdb/volcanoPlot', { body })
	}

	/** May use mapper instead as more termTypes are added */
	async getData() {
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
			min_samples_per_group: this.settings.minSamplesPerGroup
		} as Partial<DiffMethRequest>
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
			termId: this.config.termId,
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
