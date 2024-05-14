import { Menu } from '../../dom/menu'
import { addGeneSearchbox } from '../../dom/genesearch'
import { TermTypes } from '../../shared/terms'

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
			geneOnly: true,
			callback: () => this.selectGene(geneSearch.geneSymbol),
			hideHelp: true,
			focusOff: true
		})
	}

	async selectGene(gene) {
		if (!gene) throw new Error('No gene selected')
		this.callback({ gene, type: TermTypes.GENE_EXPRESSION, name: gene })
	}
}
