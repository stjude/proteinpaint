import { Menu, addGeneSearchbox } from '#dom'
import { TermTypes } from '#types'
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
			termdbConfig: opts.app.vocabApi.termdbConfig,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch)
		})
	}

	async selectGene(geneSearch) {
		const gene = geneSearch?.geneSymbol
		if (!gene) throw new Error('No gene selected')
		const unit = getGEunit(this.app.vocabApi)
		const name = `${gene} ${unit}`
		this.callback({
			q: { sampleType: geneSearch.sampleType },
			term: { gene, name, type: TermTypes.GENE_EXPRESSION }
		})
	}
}
