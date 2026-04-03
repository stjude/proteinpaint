import type { AppApi } from '#rx'
import { TermTypeGroups } from '#shared/terms.js'
import { sayerror } from '#dom'

export class SearchHandler {
	callback?: (f?: any) => void
	app?: AppApi

	async init(opts) {
		this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app

		const holder = opts.holder.append('div').style('padding', '10px 0px')
		const scctTerms = opts.app.vocabApi.termdbConfig?.termType2terms?.[TermTypeGroups.SINGLECELL_CELLTYPE]
		if (!scctTerms) {
			sayerror(
				holder,
				`termType2terms[${TermTypeGroups.SINGLECELL_CELLTYPE}]:[] is required in termdbConfig for singleCellCellType handler`
			)
			return
		}
		const plotName = opts.usecase?.specialCase?.config?.name
		const filteredTerms = plotName ? scctTerms.filter(t => t.plot == plotName) : scctTerms
		for (const t of filteredTerms) {
			holder
				/** The divs and styling duplicates the appearance of the
				 * tree terms. The tree is NOT called for this handler. */
				.append('div')
				.classed('termdiv', true)
				.style('padding', '0px 5px')
				.append('div')
				.classed('termlabel sja_filter_tag_btn sja_tree_click_term ts_pill', true)
				.style('display', 'inline-block')
				.style('padding', '5px 8px')
				.style('margin', '1px 0px')
				.style('border-radius', '6px')
				//End duplicated pill styling
				.text(t.name)
				.on('click', () => {
					this.callback!(t)
				})
		}
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
		if (opts.usecase == null) throw new Error('usecase is required')
		if (!opts.app.vocabApi.termdbConfig?.termType2terms)
			throw new Error('termType2terms is required in termdbConfig for singleCellCellType handler')
		// if (!opts.usecase?.specialCase?.config?.name) {
		// 	throw new Error('usecase.specialCase.config.name defining the plot is required for singleCellCellType handler')
		// }
	}
}
