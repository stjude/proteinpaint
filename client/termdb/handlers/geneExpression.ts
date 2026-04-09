import { Menu, addGeneSearchbox } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { getGEunit } from '#tw/geneExpression'

export class SearchHandler {
	callback: any
	app: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch.geneSymbol)
		})
	}

	async selectGene(gene) {
		const unit = getGEunit(this.app.vocabApi)
		const name = `${gene} ${unit}`
		if (!gene) throw new Error('No gene selected')
		this.callback({ gene, name, type: TermTypes.GENE_EXPRESSION })
	}
}
