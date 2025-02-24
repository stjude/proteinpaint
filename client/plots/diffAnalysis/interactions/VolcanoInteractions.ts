import type { MassAppApi } from '#mass/types/mass'
import { downloadTable, GeneSetEditUI } from '#dom'
import { to_svg } from '#src/client'
import type { DiffAnalysisPlotConfig } from '../DiffAnalysisTypes'

/** TODO:
 * 	- fix/add types
 */
export class VolcanoInteractions {
	app: MassAppApi
	dom: any
	id: string
	pValueTableData: any
	constructor(app: MassAppApi, id: string, dom: any) {
		this.app = app
		this.dom = dom
		this.id = id
		this.pValueTableData = []
	}

	setVar(app, id) {
		this.app = app
		this.id = id
	}

	/** Launches a multi-term select tree
	 * On submit, dispatches a plot_edit action with the new confounders */
	async confoundersMenu() {
		console.log('TODO: Server request does not support infinite confounders')
		return
		// const termdb = await import('#termdb/app')
		// await termdb.appInit({
		// 	holder: this.dom.tip.d.append('div').style('padding', '5px'),
		// 	vocabApi: this.app.vocabApi,
		// 	state: {
		// 		dslabel: this.app.vocabApi.opts.state.vocab.dslabel,
		// 		genome: this.app.vocabApi.opts.state.vocab.genome
		// 	},
		// 	tree: {
		// 		submit_lst: (terms: any) => {
		// 			this.app.dispatch({
		// 				type: 'plot_edit',
		// 				id: this.id
		// 				//TODO: server request does not support infinite confounders
		// 			})
		// 		}
		// 	}
		// })
	}

	clearDom() {
		this.dom.tabs.selectAll('*').remove()
		this.dom.tabsContent.selectAll('*').remove()
	}

	download() {
		this.dom.tip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.tabsContent.select('svg').node() as Node
					to_svg(svg, `boxplot`, { apply_dom_styles: true })
				}
			},
			{
				text: 'Download p value table',
				callback: () => {
					downloadTable(this.pValueTableData.rows, this.pValueTableData.columns)
				}
			}
		]
		for (const opt of opts) {
			this.dom.tip.d.append('div').attr('class', 'sja_menuoption').text(opt.text).on('click', opt.callback)
		}
	}

	async launchBoxPlot(geneSymbol: string) {
		const config = this.app.getState().plots.find((p: DiffAnalysisPlotConfig) => p.id === this.id)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'boxplot',
				groups: config.samplelst.groups,
				term: {
					q: { mode: 'continuous' },
					term: {
						gene: geneSymbol,
						name: geneSymbol,
						type: 'geneExpression' //eventually type will come from state
					}
				}
			}
		})
	}

	/** TODO: limit list to available genes
	 * Hide msigdb?? */
	launchGeneSetEdit() {
		const plotConfig = this.app.getState().plots.find((p: DiffAnalysisPlotConfig) => p.id === this.id)
		const holder = this.dom.tip.d.append('div').style('padding', '5px') as any
		new GeneSetEditUI({
			holder,
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			geneList: plotConfig.highlightData,
			callback: async result => {
				const highlightedData = result.geneList.map(d => d.gene)
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { highlightedData }
				})
				this.dom.tip.hide()
			}
		})
	}

	// async launchGSEA(settings) {
	// 	const gsea_params = {
	// 		// genes: this.genes,
	// 		fold_change: settings.foldChangeCutoff,
	// 		genome: this.app.vocabApi.opts.state.vocab.genome
	// 	}
	// 	const config = {
	// 		chartType: 'gsea',
	// 		gsea_params,
	// 	}
	// 	const opts = {
	// 		holder: this.dom.tabsContent,
	// 		state: {
	// 			vocab: this.app.opts.state.vocab,
	// 			plots: [config]
	// 		}
	// 	}
	// 	const plotImport = await import('#plots/plot.app.js')
	// 	const plotAppApi = await plotImport.appInit(opts)

	// }

	pushPlot(plot: string, value?: { [index: string]: any }) {
		const plotConfig = this.app.getState().plots.find((p: DiffAnalysisPlotConfig) => p.id === this.id)
		const visiblePlots = structuredClone(plotConfig.settings.differentialAnalysis.visiblePlots)
		visiblePlots.push(plot)
		const config = {
			childType: plot,
			settings: {
				differentialAnalysis: {
					visiblePlots
				}
			}
		} as any
		//TODO: fix this
		if (plot == 'geneORA') {
			config.settings.geneORA = config.settings.geneORA || {}
			config.settings.geneORA.pathway = value
		}

		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config
		})
	}
}
