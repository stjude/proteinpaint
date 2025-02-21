import type { MassAppApi } from '#mass/types/mass'
import { Tabs } from '#dom'
import type {
	DataPointEntry,
	DiffAnalysisDom,
	DiffAnalysisPlotConfig,
	DiffAnalysisViewData
} from '../DiffAnalysisTypes'

/** TODO: finish typing this file */
export class View {
	app: MassAppApi
	dom: DiffAnalysisDom
	config: DiffAnalysisPlotConfig
	constructor(app: MassAppApi, config: DiffAnalysisPlotConfig, dom: DiffAnalysisDom, viewData: DiffAnalysisViewData) {
		this.app = app
		this.config = config
		this.dom = dom

		this.renderDom(config, dom, viewData)
	}

	renderDom(config, dom, viewData) {
		const tabs = [
			{
				active: config.activeTab === 'volcano',
				id: 'volcano',
				label: 'Volcano',
				callback: async tab => {
					await this.tabCallback(tab)
					// new VolcanoPlot(app, dom, settings, viewData, interactions)
				}
			},
			{
				active: config.activeTab === 'gsea',
				id: 'gsea',
				label: 'Gene Set Enrichment Analysis',
				isVisible: () => config.visiblePlots.includes('gsea'),
				callback: async tab => {
					// interactions.launchGSEA(settings)
					await this.tabCallback(tab)
				}
			},
			{
				active: config.activeTab === 'geneORA',
				id: 'geneORA',
				label: 'Gene Set Overrepresentation Analysis',
				isVisible: () => config.visiblePlots.includes('geneORA'),
				callback: async tab => {
					// const plotConfig = this.getGeneORAConfig(settings.geneORA, settings.foldChangeCutoff, viewData.pointData)
					// await this.tabCallback(tab, plotConfig)
				}
			}
		]

		new Tabs({ holder: dom.tabs, content: dom.tabsContent, tabs }).main()
	}

	async tabCallback(tab, plotConfig?) {
		if (!tab || !tab.id) return
		const config = Object.assign(plotConfig, { activeTab: tab.id })
		this.app.dispatch({
			type: 'plot_edit',
			id: this.config.id,
			config
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
