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
		const usecaseConfig = opts.usecase?.specialCase?.config
		const plots = usecaseConfig?.sample?.plots

		/** Use either the usecase.config.sample.plots:[] or usecase.config.name (i.e.
		 * plot name) to filter the terms OR display all. If displaying all terms,
		 * append the plot name to the label. Only display a term once. */
		const filtered = plots
			? scctTerms.filter(t => plots.includes(t.plot))
			: usecaseConfig?.name
			? scctTerms.filter(t => t.plot === usecaseConfig.name)
			: scctTerms

		const filteredTerms: Set<any> = new Set(
			plots || !usecaseConfig?.name ? filtered.map(t => ({ ...t, label: `${t.name} (${t.plot})` })) : filtered
		)

		for (const t of Array.from(filteredTerms)) {
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
				.text(t.label || t.name)
				.on('click', () => {
					const term = this.makeTerm(t, usecaseConfig)
					this.callback!(term)
				})
		}
	}

	makeTerm(_term, usecaseConfig) {
		const term = { ..._term }
		if (!term.sample && usecaseConfig?.sample) term.sample = usecaseConfig.sample
		return term
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
		if (opts.usecase == null) throw new Error('usecase is required')
		if (!opts.app.vocabApi.termdbConfig?.termType2terms)
			throw new Error('termType2terms is required in termdbConfig for singleCellCellType handler')
	}
}
