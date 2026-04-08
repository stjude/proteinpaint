import { Menu, addGeneSearchbox } from '#dom'
import type { AppApi } from '#rx'
import { SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'
import { getSCGEunit } from '#tw/singleCellGeneExpression'
import type { SearchHandlerOpts } from '../TermTypeSearch.js'

export class SearchHandler {
	callback?: (arg0: { gene: string; name: string; type: string; sample: object }) => void
	app?: AppApi

	init(opts: SearchHandlerOpts) {
		this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: () => this.selectGene(geneSearch.geneSymbol, opts.usecase?.specialCase?.config?.sample)
		})
	}

	/**TODO: scge tw handler will validate that a sample is included. Need to resolve issue
	 * with sample info not included.*/
	async selectGene(gene: string | undefined, sample: any | undefined) {
		if (!gene) throw new Error('No gene selected')
		const unit = getSCGEunit(this.app!.vocabApi)
		const name = `${gene} ${unit}`
		this.callback!({ gene, name, type: SINGLECELL_GENE_EXPRESSION, sample })
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
		if (opts.genomeObj == null) throw new Error('genomeObj is required')
		if (opts.usecase == null) throw new Error('usecase is required')
		if (!opts.usecase?.specialCase?.config?.sample) {
			throw new Error('usecase.specialCase.config.sample is required for singleCellGeneExpression handler')
		}
	}
}
