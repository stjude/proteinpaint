import { Menu } from '#dom/menu'
import { addGeneSearchbox } from '#dom/genesearch'

const idPrefix = `_geneVariant_AUTOID_${+new Date()}_`
let id = 0

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
			this.callback({
				id: idPrefix + id++,
				gene: geneSearch.geneSymbol,
				name: geneSearch.geneSymbol,
				type: 'geneVariant'
			})
		} else if (geneSearch.chr && geneSearch.start && geneSearch.stop) {
			const { chr, start, stop } = geneSearch
			// name should be 1-based coordinate
			this.callback({ id: idPrefix + id++, chr, start, stop, name: `${chr}:${start + 1}-${stop}`, type: 'geneVariant' })
		} else {
			throw 'no gene or position specified'
		}
	}
}
