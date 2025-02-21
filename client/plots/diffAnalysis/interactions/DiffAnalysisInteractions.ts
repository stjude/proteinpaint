import type { MassAppApi } from '#mass/types/mass'
import { downloadTable } from '#dom'
import { to_svg } from '#src/client'
import type { DiffAnalysisDom, DiffAnalysisPlotConfig } from '../DiffAnalysisTypes'

export class DiffAnalysisInteractions {
	app: MassAppApi
	dom: DiffAnalysisDom
	id: string
	pValueTableData: any
	constructor(app: MassAppApi, id: string, dom: DiffAnalysisDom) {
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
		this.dom.div.selectAll('table').remove()
		this.dom.actions.selectAll('*').remove()
		this.dom.plot.selectAll('*').remove()
		this.dom.xAxis.selectAll('*').remove()
		this.dom.yAxisLabel.text('')
		this.dom.yAxis.selectAll('*').remove()
	}

	download() {
		this.dom.tip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.svg.node() as Node
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

	launchGSEA(value: string, foldChangeCutoff: number, data: any) {
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

		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'geneORA',
				geneORAparams
			}
		})
	}
}
