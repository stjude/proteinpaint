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
			callback: () => this.selectGene(geneSearch),
			hideHelp: true,
			focusOff: true
		})
	}

	async selectGene(geneSearch) {
		if (geneSearch.geneSymbol) {
			this.callback({ gene: geneSearch.geneSymbol, name: geneSearch.geneSymbol, type: 'geneVariant' })
		} else if (geneSearch.chr && geneSearch.start && geneSearch.stop) {
			const { chr, start, stop } = geneSearch
			// TODO: 0/1-based coordinate?
			this.callback({ chr, start, stop, name: `${chr}:${start}-${stop}`, type: 'geneVariant' })
		} else {
			throw 'no gene or position specified'
		}
	}
}
