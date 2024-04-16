import { Menu } from '#dom/menu'
import { addGeneSearchbox } from '#dom/genesearch'

export class SearchHandler {
	callback: any

	init(opts) {
		this.callback = opts.callback
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

	async selectGene(name) {
		if (name) this.callback({ name, type: 'geneVariant' })
	}
}
