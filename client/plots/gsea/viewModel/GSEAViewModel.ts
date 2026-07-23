import type { GSEA } from '../GSEA'
import { roundValueAuto } from '#shared/roundValue.js'

type PathwayOpt = { label: string; value: string; selected?: boolean }

type GseaResultEntry = {
	geneset_size: number
	leading_edge: string
	fdr?: number
	pvalue?: number
	nes?: number
	auc?: number
	es?: number
}

type RankedDE = {
	genes: string[]
	fold_change: number[]
}

export class GSEAViewModel {
	gsea: GSEA
	//Initial pathway opts from ds. Do not mutate this directly
	initPathwayOpts: PathwayOpt[]
	rankedDE: RankedDE | null = null
	rankedDEKey = ''
	viewData!: any

	constructor(gsea: GSEA) {
		this.gsea = gsea
		this.initPathwayOpts = structuredClone(gsea.app.opts.genome.termdbs.msigdb.analysisGenesetGroups)
	}

	async processData() {
		const settings = this.gsea.state.config.settings.gsea
		const viewData: any = {
			pathwayOpts: this.getPathwayOpts(settings)
		}

		if (!settings.pathway || settings.pathway == '-') {
			this.viewData = viewData
			return
		}

		let outputMap: Record<string, GseaResultEntry>
		try {
			const output = await this.gsea.model.runEnrichment(this.getRequestBody(settings))
			if (output?.error) throw Object.assign(new Error(output.error), { code: output.code })
			outputMap = this.getOutputMap(output, settings.gsea_method)
		} catch (e: any) {
			const msg = String(e?.message || e)
			if (e?.code === 'CACHE_BUSY') {
				if (window.confirm(msg)) {
					await this.processData()
					return
				}
				this.viewData = viewData
				return
			}
			viewData.error = /daCacheMissing|ENOENT|no such file/i.test(msg)
				? 'The differential-analysis cache for this GSEA is no longer available. Reopen the volcano plot to regenerate it.'
				: msg
			this.viewData = viewData
			return
		}

		viewData.statsData = this.getStatsData(outputMap)
		viewData.tableData = this.getTableData(outputMap, settings)
		viewData.selectedRows = this.getSelectedRows(viewData.tableData.rowItems)
		viewData.showHighlightButton =
			this.gsea.state.config.chartType == 'differentialAnalysis' &&
			this.gsea.state.config.gsea_params?.geneset_name != null

		const selectedGeneset = this.gsea.state.config.gsea_params?.geneset_name
		if (selectedGeneset) {
			if (settings.gsea_method == 'blitzgsea') {
				try {
					viewData.detailImage = await this.getDetailImage(settings, selectedGeneset)
				} catch (e: any) {
					const msg = String(e?.message || e)
					if (e?.code === 'CACHE_BUSY') {
						if (window.confirm(msg)) {
							await this.processData()
							return
						}
					} else {
						viewData.detailError = /daCacheMissing|ENOENT|no such file/i.test(msg)
							? 'The differential-analysis cache for this GSEA is no longer available. Reopen the volcano plot to regenerate it.'
							: msg
					}
				}
			} else {
				viewData.cernoPlotData = await this.getCernoPlotData(outputMap, selectedGeneset)
			}
		}

		this.viewData = viewData
	}

	getPathwayOpts(settings) {
		//Do not mutate the initial array
		const pathwayOpts = structuredClone(this.initPathwayOpts)
		if (this.gsea.testEnabled && settings.gsea_method == 'blitzgsea') {
			pathwayOpts.push(
				{ label: 'REACTOME (blitzgsea)', value: 'REACTOME--blitzgsea' },
				{ label: 'KEGG (blitzgsea)', value: 'KEGG--blitzgsea' },
				{ label: 'WikiPathways (blitzgsea)', value: 'WikiPathways--blitzgsea' }
			)
		}
		if (settings.pathway) {
			//Note: in the ds file, `{ label: '-', value: '-' }` is analysisGenesetGroups[0]
			pathwayOpts.shift()
			const opt = pathwayOpts.find(opt => opt.value == settings.pathway)
			if (!opt) console.warn(`Selected pathway ${settings.pathway} not found in pathway options.`)
			else opt.selected = true
		}
		return pathwayOpts
	}

	getRequestBody(settings, geneset_name?: string) {
		const p = this.gsea.gsea_params
		const body: any = {
			genome: p.genome,
			geneSetGroup: settings.pathway,
			filter_non_coding_genes: settings.filter_non_coding_genes,
			method: settings.gsea_method
		}
		if (p.cacheId) {
			body.cacheId = p.cacheId
			if (p.daRequest) body.daRequest = p.daRequest
			if (p.dslabel) body.dslabel = p.dslabel
		} else if (p.dapParams) {
			body.dapParams = p.dapParams
			body.dslabel = p.dslabel
		} else {
			body.genes = p.genes
			body.fold_change = p.fold_change
		}

		if (settings.gsea_method == 'blitzgsea') {
			body.num_permutations = settings.num_permutations
		}
		if (geneset_name) body.geneset_name = geneset_name
		return body
	}

	getOutputMap(output: any, method: string): Record<string, GseaResultEntry> {
		if (method == 'blitzgsea') {
			if (!output?.data || typeof output.data != 'object') throw new Error('Invalid blitzgsea response')
			return output.data
		}

		if (output?.data && !Array.isArray(output.data) && !output.data.genes && !output.data.fold_change) {
			return output.data
		}
		if (output && typeof output == 'object' && !Array.isArray(output)) return output
		throw new Error('Invalid cerno response')
	}

	getStatsData(outputMap: Record<string, GseaResultEntry>) {
		return [{ label: 'Gene sets analyzed', value: Object.keys(outputMap).length }]
	}

	getTableData(outputMap: Record<string, GseaResultEntry>, settings) {
		const entries = Object.entries(outputMap).map(([genesetName, result]) => ({ genesetName, result }))
		const rowItems: any[] = []

		if (settings.fdr_or_top == 'top') {
			entries.sort((a, b) => Number(a.result.fdr ?? Infinity) - Number(b.result.fdr ?? Infinity))
			for (let index = 0; index < Math.min(settings.top_genesets, entries.length); index++) {
				const item = entries[index]
				if (this.withinSizeCutoff(item.result, settings)) rowItems.push(this.makeRowItem(item, settings.gsea_method))
			}
		} else {
			for (const item of entries) {
				if (!this.withinSizeCutoff(item.result, settings)) continue
				if (Number(item.result.fdr ?? Infinity) > settings.fdr_cutoff) continue
				rowItems.push(this.makeRowItem(item, settings.gsea_method))
			}
		}

		return {
			columns: this.getTableColumns(settings.gsea_method),
			rows: rowItems.map(item => item.row),
			rowItems
		}
	}

	withinSizeCutoff(result: GseaResultEntry, settings) {
		return (
			settings.max_gene_set_size_cutoff >= result.geneset_size &&
			settings.min_gene_set_size_cutoff <= result.geneset_size
		)
	}

	makeRowItem(item: { genesetName: string; result: GseaResultEntry }, method: string) {
		const pvalue = item.result.pvalue != null ? roundValueAuto(item.result.pvalue) : item.result.pvalue
		const fdr = item.result.fdr != null ? roundValueAuto(item.result.fdr) : item.result.fdr
		const leadingEdge = item.result.leading_edge
		const genes = leadingEdge
			? leadingEdge
					.split(',')
					.map(gene => gene.trim())
					.filter(Boolean)
			: []

		if (method == 'blitzgsea') {
			const nes = item.result.nes != null ? roundValueAuto(item.result.nes) : item.result.nes
			return {
				genesetName: item.genesetName,
				genes,
				row: [
					{ value: item.genesetName },
					{ value: nes },
					{ value: item.result.geneset_size },
					{ value: pvalue },
					{ value: fdr },
					{ value: leadingEdge }
				]
			}
		}

		const auc = item.result.auc != null ? roundValueAuto(item.result.auc) : item.result.auc
		const es = item.result.es != null ? roundValueAuto(item.result.es) : item.result.es
		return {
			genesetName: item.genesetName,
			genes,
			row: [
				{ value: item.genesetName },
				{ value: auc },
				{ value: es },
				{ value: item.result.geneset_size },
				{ value: pvalue },
				{ value: fdr },
				{ value: leadingEdge }
			]
		}
	}

	getTableColumns(method: string) {
		if (method == 'blitzgsea') {
			return [
				{ label: 'Gene Set', sortable: true },
				{ label: 'Normalized Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
				{ label: 'Gene Set Size', sortable: true },
				{ label: 'P value', sortable: true },
				{ label: 'FDR', sortable: true },
				{ label: 'Leading Edge' }
			]
		}

		return [
			{ label: 'Gene Set', sortable: true },
			{ label: 'Area Under Curve', barplot: { axisWidth: 200 }, sortable: true },
			{ label: 'Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
			{ label: 'Total Gene Set Size', sortable: true },
			{ label: 'P value', sortable: true },
			{ label: 'FDR', sortable: true },
			{ label: 'Gene Set Hits' }
		]
	}

	getSelectedRows(rowItems: any[]) {
		const selectedGeneset = this.gsea.state.config.gsea_params?.geneset_name
		const selectedIndex = rowItems.findIndex(item => item.genesetName == selectedGeneset)
		return selectedIndex > -1 ? [selectedIndex] : []
	}

	async getDetailImage(settings, genesetName: string) {
		const image = await this.gsea.model.runEnrichment(this.getRequestBody(settings, genesetName))
		if (image?.error) throw Object.assign(new Error(image.error), { code: image.code })

		if (this.gsea.imageUrl) URL.revokeObjectURL(this.gsea.imageUrl)
		this.gsea.imageUrl = URL.createObjectURL(image)
		return {
			src: this.gsea.imageUrl,
			width: 600,
			height: 400
		}
	}

	async getCernoPlotData(outputMap: Record<string, GseaResultEntry>, genesetName: string) {
		const selected = outputMap[genesetName]
		if (!selected) throw new Error(`${genesetName} not found`)

		const rankedDE = await this.getRankedDE()
		const rankedGenes = rankedDE.genes.map((gene, index) => ({ gene, fold_change: rankedDE.fold_change[index] }))
		rankedGenes.sort((a, b) => b.fold_change - a.fold_change)

		return {
			auc: selected.auc,
			genesetName,
			leadingEdgeGenes: selected.leading_edge
				.split(',')
				.map(gene => gene.trim())
				.filter(Boolean),
			rankedGenes
		}
	}

	async getRankedDE(): Promise<RankedDE> {
		const cacheKey = this.getRankedDECacheKey()
		if (this.rankedDE && this.rankedDEKey == cacheKey) return this.rankedDE

		if (!this.gsea.gsea_params.cacheId && !this.gsea.gsea_params.dapParams) {
			const rankedDE = {
				genes: this.gsea.gsea_params.genes,
				fold_change: this.gsea.gsea_params.fold_change
			}
			this.rankedDE = rankedDE
			this.rankedDEKey = cacheKey
			return rankedDE
		}

		const response = await this.gsea.model.runEnrichment({
			genome: this.gsea.gsea_params.genome,
			dslabel: this.gsea.gsea_params.dslabel,
			fetchDE: true,
			geneSetGroup: '-',
			filter_non_coding_genes: false,
			method: 'cerno',
			...(this.gsea.gsea_params.cacheId
				? {
						cacheId: this.gsea.gsea_params.cacheId,
						daRequest: this.gsea.gsea_params.daRequest
				  }
				: { dapParams: this.gsea.gsea_params.dapParams })
		})
		if (response?.error) throw Object.assign(new Error(response.error), { code: response.code })

		const rankedDE = response.data as RankedDE
		this.rankedDE = rankedDE
		this.rankedDEKey = cacheKey
		return rankedDE
	}

	getRankedDECacheKey() {
		if (this.gsea.gsea_params.cacheId) return `cache:${this.gsea.gsea_params.cacheId}`
		if (this.gsea.gsea_params.dapParams) return `dap:${JSON.stringify(this.gsea.gsea_params.dapParams)}`
		const genes = this.gsea.gsea_params.genes || []
		return `inline:${genes.length}:${genes[0] || ''}:${genes[genes.length - 1] || ''}`
	}
}
