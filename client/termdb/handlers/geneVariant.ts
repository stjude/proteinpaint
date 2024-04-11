import { Menu } from '#dom/menu'
import { addGeneSearchbox } from '#dom/genesearch'
import { fillTermWrapper } from '#termsetting'

export class SearchHandler {
	app: any
	callback: any

	init(opts) {
		this.app = opts.app
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
		const term = await fillTermWrapper({ term: { name, type: 'geneVariant' } }, this.app.vocabApi)
	}
}
