import type { MassAppApi } from '#mass/types/mass'
import { Tabs } from '#dom'
import type { DataPointEntry, DiffAnalysisDom } from '../DiffAnalysisTypes'
import { getPlotConfig } from '#plots/boxplot.js'

/** TODO: finish typing this file */
export class View {
	app: MassAppApi
	config: any
	dom: DiffAnalysisDom
	viewData: any
	constructor(app: MassAppApi, config, dom: DiffAnalysisDom) {
		this.app = app
		this.dom = dom
		this.config = config
		this.viewData = []

		this.renderDom()
	}

	setViewData(viewData: DataPointEntry[]) {
		this.viewData = viewData
	}

	renderDom() {
		const settings = this.config.settings.differentialAnalysis
		const tabs = [
			{
				active: this.config.childType === 'volcano',
				id: 'volcano',
				label: 'Volcano',
				callback: async tab => await this.tabCallback(tab)
			},
			{
				active: this.config.childType === 'gsea',
				id: 'gsea',
				label: 'Gene Set Enrichment Analysis',
				isVisible: () => settings.visiblePlots.includes('gsea'),
				callback: async tab => await this.tabCallback(tab)
			},
			{
				active: this.config.childType === 'geneORA',
				id: 'geneORA',
				label: 'Gene Set Overrepresentation Analysis',
				isVisible: () => settings.visiblePlots.includes('geneORA'),
				getPlotConfig: () =>
					this.getGeneORAConfig(settings.geneORA, settings.foldChangeCutoff, this.viewData.pointData),
				callback: async tab => await this.tabCallback(tab)
			}
		]

		new Tabs({ holder: this.dom.tabs, content: this.dom.tabsContent, tabs }).main()
	}

	async tabCallback(tab) {
		if (!tab || !tab.id) return
		const plotConfig = tab.getPlotConfig()
		this.app.dispatch({
			type: 'plot_edit',
			id: this.config.id,
			config: plotConfig
		})
	}

	async getGeneORAConfig(value: string, foldChangeCutoff: number, data: DataPointEntry[]) {
		const sample_genes: any = []
		const background_genes: any = []

		for (const d of data) {
			if (d.gene_symbol.length > 0) {
				// Do not include blank rows
				if (value == 'upregulated' && foldChangeCutoff < Math.abs(d.fold_change) && d.fold_change > 0) {
					sample_genes.push(d.gene_symbol)
				}
				if (value == 'downregulated' && foldChangeCutoff < Math.abs(d.fold_change) && d.fold_change < 0) {
					sample_genes.push(d.gene_symbol)
				}
				if (value == 'both' && foldChangeCutoff < Math.abs(d.fold_change)) {
					sample_genes.push(d.gene_symbol)
				}
				background_genes.push(d.gene_symbol)
			}
		}

		const geneORAparams = {
			sample_genes: sample_genes.toString(),
			background_genes: background_genes.toString(),
			genome: this.app.vocabApi.opts.state.vocab.genome,
			ora_request_type: value,
			num_samples_genes: sample_genes.length,
			num_background_genes: background_genes.length
		}

		return {
			childType: 'geneORA',
			geneORAparams
		}
	}
}
