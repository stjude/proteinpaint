import type { MassAppApi } from '#mass/types/mass'
import { downloadTable } from '#dom'
import { to_svg } from '#src/client'
import type { DiffAnalysisDom } from '../DiffAnalysisTypes'

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

	clearDom() {
		this.dom.div.selectAll('table').remove()
		this.dom.actions.selectAll('*').remove()
		this.dom.plot.selectAll('*').remove()
		this.dom.xAxis.selectAll('*').remove()
		this.dom.yAxisLabel.text('')
		this.dom.yAxis.selectAll('*').remove()
	}
}
