import { Menu, addGeneSearchbox } from '#dom'
import type { AppApi } from '#rx'
import { TermTypes } from '#shared/terms.js'
import { getSCGEunit } from '#tw/singleCellGeneExpression'

export class SearchHandler {
	callback?: (arg0: { gene: string; name: string; type: string }) => void
	app?: AppApi

	init(opts) {
		this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch.geneSymbol)
		})
	}

	async selectGene(gene: string | undefined) {
		if (!gene) throw new Error('No gene selected')
		const unit = getSCGEunit(this.app!.vocabApi)
		const name = `${gene} ${unit}`
		this.callback!({ gene, name, type: TermTypes.SINGLECELL_GENE_EXPRESSION })
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
		if (opts.genomeObj == null) throw new Error('genomeObj is required')
	}
}
