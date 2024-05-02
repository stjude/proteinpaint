import { Menu } from '#dom/menu'
import { addGeneSearchbox } from '#dom/genesearch'
// in rollup, the #shared alias breaks using the dynamic-import-vars plugin,
// presumably because the handler code is dynamically imported and the plugin
// is not aware of the subpath "imports" object in client/package.json
// use relative paths to shared code for now
// TODO: extract the shared code into `@sjcrh/proteinpaint-core` or `...-shared`
import { TermTypes } from '../../shared/common.js'
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
		this.callback({ id: gene, gene, type: TermTypes.GENE_EXPRESSION, name: gene })
	}
}
