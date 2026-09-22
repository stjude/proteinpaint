import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { DERequest, DiffMethRequest, TermdbSingleCellDEgenesRequest, VolcanoRenderRequest } from '#types'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { getGroupColors, toHex } from '../colors'
import { DMRCATE_DEFAULTS } from '../settings/defaults'
import { isExcessAxis } from '../settings/Settings'
// import type { Volcano } from '../Volcano'

export class VolcanoModel {
	plot: any
	app: MassAppApi
	config!: any
	settings!: any
	termType: string

	/** TODO: This model is used in both the volcano and gsea.
	 * In the future, create base model in DA and use specific
	 * classes for the volcano and gsea. */
	constructor(plot: any, termType: string) {
		this.plot = plot
		this.app = plot.app
		this.termType = termType
	}

	/** May use mapper instead as more termTypes are added */
	async getData(config: any, settings: any) {
		this.config = config
		this.settings = settings

		if (this.termType === tt.GENE_EXPRESSION) {
			const body = await this.getGERequestBody()
			const response = await dofetch3('termdb/DE', { body, signal: this.plot.api?.getAbortSignal() })
			// Surface the DE request so downstream plots (GSEA) can snapshot
			// it and later ask the server to recompute the DA cache if the
			// file is missing on a peer node or after TTL eviction.
			if (response && !response.error) response.daRequest = body
			return response
		}
		if (this.termType === tt.DNA_METHYLATION) {
			const body = await this.getDMRequestBody()
			const response = await dofetch3('termdb/diffMeth', { body, signal: this.plot.api?.getAbortSignal() })
			// Surface the DM request the same way the GE branch above does so
			// the GSEA tab can snapshot it and the server can recompute the DM
			// cache if the file is missing on a peer node or after TTL.
			if (response && !response.error) response.daRequest = body
			return response
		}
		if (this.termType === tt.SINGLECELL_CELLTYPE) {
			const body = await this.getSCCTRequestBody()
			return await dofetch3('termdb/singlecellDEgenes', { body, signal: this.plot.api?.getAbortSignal() })
		}
		if (this.termType === tt.PROTEOME_DAP) {
			const body = this.getDapRequestBody()
			return await dofetch3('termdb/dapVolcano', { body, signal: this.plot.api?.getAbortSignal() })
		}
		if (this.termType === tt.SINGLECELL_GENE_EXPRESSION) {
			//TODO
		}
		throw new Error(`Volcano plot does not support route for termType='${this.termType}'`)
	}

	//Gene expression
	async getGERequestBody() {
		await this.getOtherSamples(this.config.samplelst)
		const state = this.app.getState()
		const body = {
			kind: 'DE',
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
		const pseudobulk = this.config.tw?.pseudobulk
		if (pseudobulk) body.pseudobulk = pseudobulk

		this.addConfounderTw(body)

		return body
	}

	//DNA methylation
	async getDMRequestBody() {
		await this.getOtherSamples(this.config.samplelst)
		const state = this.app.getState()
		const body = {
			kind: 'DM',
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			samplelst: this.config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			min_samples_per_group: this.settings.minSamplesPerGroup,
			exclude_sex_chr: this.settings.excludeSexChr,
			/* Omitted rather than sent as 'promoter' when it is the default, so a request
			from a promoter-only dataset is byte-identical to what this client sent before
			the element picker existed. The server resolves an absent element_type to
			'promoter'. This does NOT preserve cache keys -- the key object gained the
			field server-side, so every pre-existing dm/ entry is orphaned on deploy
			regardless of what the client sends. */
			...(this.settings.elementType && this.settings.elementType != 'promoter'
				? { element_type: this.settings.elementType }
				: {}),
			// the scan's own knobs; the server ignores them for any other element type
			...(this.settings.elementType == DMR_SCAN_ELEMENT_TYPE
				? {
						scan: {
							...(this.settings.scanChromosome ? { chromosome: this.settings.scanChromosome } : {}),
							backgroundCorrection: !!this.settings.backgroundCorrection,
							minCpgs: this.settings.minCpgs,
							profileBinBp: this.settings.profileBinBp,
							// only when changed: an explicit default would orphan every cached scan
							...(this.settings.lambda != DMRCATE_DEFAULTS.lambda ? { lambda: this.settings.lambda } : {}),
							...(this.settings.C != DMRCATE_DEFAULTS.C ? { C: this.settings.C } : {}),
							...(this.settings.fdrCutoff != DMRCATE_DEFAULTS.fdrCutoff ? { fdrCutoff: this.settings.fdrCutoff } : {})
						}
				  }
				: {}),
			volcanoRender: this.getVolcanoRender()
		} as Partial<DiffMethRequest>

		/* The scan fits no covariates and the server rejects a scan request carrying them. Confounders
		chosen under an element class stay in the config when the class switches to the scan, so they
		are left off here rather than failing every scan until the user finds and clears them. */
		if (this.settings.elementType != DMR_SCAN_ELEMENT_TYPE) this.addConfounderTw(body)

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
		/* Only differential methylation carries delta_beta, and only it offers the axis toggle, so
		other term types always fall through to fold_change. The cutoff sent must be in the units
		of the field sent -- otherwise the server draws threshold lines that do not correspond to
		what it classified. */
		const useDeltaBeta = this.termType === tt.DNA_METHYLATION && this.settings.xAxis == 'delta_beta'
		/* A background-corrected scan is plotted on the excess over matched background, not on raw
		delta-beta. The corrected p answers "did this region move more than its stratum drifts", so
		the effect size beside it has to be the same quantity: on a cohort drifting +0.09 the raw
		cutoff let a hyper region in on an excess of +0.01 while demanding -0.19 of a hypo one, and
		the up:down ratio then measured the gate rather than the biology. Sending the field here
		moves the axis, the threshold lines, the direction counts and the significant-row selection
		together, because the server reads all four off this one column. */
		const xIsExcess = useDeltaBeta && isExcessAxis(this.settings)
		return {
			significanceThresholds: {
				pValueCutoff: this.settings.pValue,
				pValueType: this.settings.pValueType,
				foldChangeCutoff: useDeltaBeta ? this.settings.deltaBetaCutoff : this.settings.foldChangeCutoff
			},
			...(useDeltaBeta ? { xField: xIsExcess ? ('excess' as const) : ('delta_beta' as const) } : {}),
			/* Tied to the delta-beta axis: the control that sets it is only offered for
			methylation, and centering a log2 fold-change axis is a different conversation.
			Never on top of the correction -- excess is already the drift subtracted per stratum,
			and recentring it on its own median would subtract a shift that is no longer there. */
			...(useDeltaBeta && this.settings.centerDeltaBeta && !xIsExcess ? { centerX: true } : {}),
			pixelWidth: this.settings.width,
			pixelHeight: this.settings.height,
			colorSignificant: toHex(this.settings.defaultSignColor, 'red'),
			colorSignificantUp: caseColor,
			colorSignificantDown: controlColor,
			colorNonsignificant: toHex(this.settings.defaultNonSignColor, 'black'),
			dotRadius,
			maxInteractiveDots: this.settings.maxInteractiveDots,
			// Render the PNG at device-pixel resolution so it stays sharp on
			// retina screens. The server reports the plot extent in CSS-space,
			// so SVG overlay coords are unaffected.
			//
			// Oversample by 2× so the PNG also stays sharp when the user
			// *zooms in after* the initial render (the captured DPR is frozen
			// at fetch time — bigger headroom = more tolerable post-render
			// zoom before pixelation appears). The server clamp keeps the
			// bitmap memory bounded.
			devicePixelRatio: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 2
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

	getDapRequestBody() {
		const { organism, assay, cohort } = this.config.proteomeDetails
		return {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			organism,
			assay,
			cohort,
			volcanoRender: this.getVolcanoRender()
		}
	}

	/** retrieve the sampleId/sampleName for samples in
	 * the "others" group instead of using {in: false} */
	async getOtherSamples(samplelst) {
		const othersSamplesGroup = samplelst.groups.find(g => !g.in)
		if (!othersSamplesGroup) return

		const state = this.app.getState()
		const samplesGroup = samplelst.groups.find(g => g.in)
		othersSamplesGroup.values = []
		// retrieve full list of samples based on current filter. put samples not in samplesGroup in "others" group.
		// the plot-scoped vocabApi from PlotBase is used, so that an unrelated app dispatch does not cancel this request
		for (const s of await this.plot.vocabApi.getFilteredSampleList(state.termfilter.filter)) {
			// s={id,name}, samplelst.groups[].values[]={sampleId,sample}
			// NOTE: must not use indexOf() here, it compares by strict equality and not by predicate,
			// which would never match and would put every sample in the "others" group
			if (!samplesGroup.values.some(i => i.sampleId == s.id)) {
				othersSamplesGroup.values.push({ sampleId: s.id, sample: s.name })
			}
		}
		othersSamplesGroup.in = true
	}
}
