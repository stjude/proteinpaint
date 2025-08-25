import { Menu, addGeneSearchbox } from '#dom'
import { TermTypes } from '#shared/terms.js'

export class SearchHandler {
	callback: any
	app: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: opts.holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch.geneSymbol)
		})
	}

	async selectGene(gene) {
		const unit = this.app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
		const name = `${gene} ${unit}`
		if (!gene) throw new Error('No gene selected')
		this.callback({ gene, name, type: TermTypes.GENE_EXPRESSION })
	}
}
