import { Menu, addGeneSearchbox } from '#dom'

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
			callback: async () => await this.selectCoord(geneSearch)
		})
	}

	async selectCoord(geneSearch) {
		const { chr, start, stop } = geneSearch
		if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('incomplete coordinate')
		// TODO: currently, when inputting a single position (e.g. chr17:7661778 or chr17:7661778-7661778), the output is a region 400bp long. Need to support single position input.
		// TODO: verify whether coordiante is 0-based or 1-based (need to do the same for other search handlers e.g. geneVariant.ts, snp.ts, etc.)
		const coord = `${chr}:${start}-${stop}`
		const unit = 'Beta Values'
		const term = {
			id: coord,
			chr,
			start,
			stop,
			name: `${coord} ${unit}`, // will also allow to be user-assigned
			type: 'dnaMethylation'
		}
		await this.callback(term)
	}
}
