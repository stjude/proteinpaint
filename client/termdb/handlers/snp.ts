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
			snpOnly: true,
			allowVariant: true,
			callback: () => this.selectSnp(geneSearch)
		})
	}

	async selectSnp(geneSearch) {
		const { chr, ref, alt, fromWhat } = geneSearch
		if (!chr || !ref || !alt || !fromWhat) throw 'missing chr, ref, alt, or fromWhat of snp'
		let start: number, stop: number
		if (!geneSearch.start && !geneSearch.stop) {
			if (geneSearch.pos) {
				// coordinate is .pos if input to geneSearch was
				// in variant/hgvs format
				// TODO: harmonize geneSearch output (also see TODO below)
				start = geneSearch.pos - 1
				stop = geneSearch.pos
			} else {
				throw 'missing coordinate of snp'
			}
		} else {
			start = geneSearch.start
			stop = geneSearch.stop
		}
		const term = {
			id: fromWhat,
			chr,
			start,
			stop,
			name: fromWhat,
			ref,
			alt: typeof alt == 'string' ? [alt] : alt, // is string if input to geneSearch was in variant or hgvs format // TODO: update genesearch.ts to parse alternative alleles from any input format into arrays
			type: 'snp'
		}
		this.callback(term)
	}
}
