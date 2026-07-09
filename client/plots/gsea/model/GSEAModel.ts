import type { GSEA } from '../gsea'
import { type GseaParams, isProteomeDAPGseaParams, isScctGseaParams, isOtherTermTypesGseaParams } from './GseaParams'
import { PROTEOME_DAP, SINGLECELL_CELLTYPE } from '#types'
import type { AppApi } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { VolcanoModel } from '#plots/volcano/model/VolcanoModel.ts'
import { getDefaultVolcanoSettings } from '#plots/volcano/settings/defaults.ts'
import type { GenesetEnrichmentRequest } from '#types'

export class GSEAModel {
	gsea: GSEA
	app: AppApi
	signal: any
	termType!: string

	constructor(gsea: GSEA) {
		this.gsea = gsea
		this.app = gsea.app
		this.signal = gsea.app?.getAbortSignal()
	}

	async getGseaParams(_params: any, state: any, config: any): Promise<GseaParams> {
		if (!this.termType) this.termType = config.termType
		const params = structuredClone(_params)
		if (!params.genome) params.genome = state.genome
		if (!params.dslabel) params.dslabel = state.dslabel

		if (this.termType === PROTEOME_DAP) this.getProteomeDAPParams(params)
		else if (this.termType === SINGLECELL_CELLTYPE) await this.getScctParams(params, state, config)
		else await this.getOtherTermTypesParams(params, config)
		return params
	}

	getProteomeDAPParams(params: any): void {
		if (isProteomeDAPGseaParams(params)) return
		if (!params.dapParams) params.dapParams = this.gsea.state.config.proteomeDetails
	}

	async getScctParams(params: any, state, config): Promise<void> {
		if (isScctGseaParams(params)) return

		// SCCT has no DA cache — fetch the full DE gene list for the
		// chosen cluster (omit volcanoRender so the route returns the
		// raw gene array, not the threshold-passing `dots` subset)
		// and pass genes + fold_change inline. `render_gsea` takes
		// this path when neither cacheId nor dapParams is set.

		let response
		try {
			response = await this.getDEGenes(state, config)
			if (response.error) throw new Error(response.error)
			if (!Array.isArray(response.data) || response.data.length === 0) {
				throw new Error('No DE genes returned for this cluster')
			}
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw new Error(e.message || e)
		}

		//Process returned response into params
		const genes: string[] = []
		const fold_change: number[] = []
		for (const g of response.data) {
			genes.push(g.gene_name)
			fold_change.push(g.fold_change)
		}
		params.genes = genes
		params.fold_change = fold_change
		params.genes_length = genes.length
	}

	async getDEGenes(state, config): Promise<any> {
		const body = {
			genome: state.genome,
			dslabel: state.dslabel,
			sample: config.sample,
			termId: config.termId,
			categoryName: config.categoryName
		}
		return await dofetch3('termdb/singlecellDEgenes', { body, signal: this.signal })
	}

	async getOtherTermTypesParams(params: any, config): Promise<void> {
		if (isOtherTermTypesGseaParams(params)) return
		let response
		try {
			response = await this.getCachedResponse(config)
			if (!response?.data?.cacheId || response.error) {
				throw new Error(response.error || 'No DE cacheId returned from volcano model')
			}
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw new Error(e.message || e)
		}

		params.cacheId = response.data.cacheId
		params.daRequest = response.daRequest
		params.genes_length = response.data.totalRows
	}

	async getCachedResponse(config): Promise<any> {
		const volcanoSettings = config.settings?.volcano || getDefaultVolcanoSettings({}, { termType: config.termType })
		const model = new VolcanoModel(this.gsea, config.termType)
		return await model.getData(config, volcanoSettings)
	}

	async runEnrichment(body: GenesetEnrichmentRequest): Promise<any> {
		this.toggleLoading(true)
		try {
			return await dofetch3('genesetEnrichment', { body, signal: this.signal })
		} finally {
			this.toggleLoading(false)
		}
	}

	toggleLoading(isLoading: boolean): void {
		this.gsea.dom.actionsDiv.style('display', isLoading ? 'none' : 'block')
		this.gsea.dom.loadingDiv.style('display', isLoading ? 'block' : 'none')
	}
}
