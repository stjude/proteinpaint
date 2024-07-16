import { Menu } from '#dom/menu'
import { addGeneSearchbox } from '../../dom/genesearch.ts'

export class SearchHandler {
	callback: any

	init(opts) {
		this.callback = opts.callback
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: opts.holder,
			callback: () => this.selectSnp(geneSearch),
			hideHelp: true,
			focusOff: true
		})
	}

	async selectSnp(geneSearch) {
		const { chr, start, stop, ref, alt, fromWhat } = geneSearch
		if (!chr || !start || !stop || !ref || !alt || !fromWhat) throw 'missing snp metadata'
		this.callback({ id: fromWhat, chr, start, stop, name: fromWhat, ref, alt, type: 'snp' })
	}
}
