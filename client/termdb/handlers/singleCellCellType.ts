import type { AppApi } from '#rx'
import { appInit } from '#termdb/app'
import { TermTypeGroups } from '#shared/terms.js'

export class SearchHandler {
	callback?: (f?: any) => void
	app?: AppApi

	async init(opts) {
		this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app
		const scctTerms = opts.app.vocabApi.termdbConfig?.termType2terms?.[TermTypeGroups.SINGLECELL_CELLTYPE]
		if (!scctTerms) {
			throw new Error('termType2terms.singleCellCellType:[] is required in termdbConfig for singleCellCellType handler')
		}
		const scDsLabel = Object.keys(opts.genomeObj.termdbs || {})[0]
		if (!scDsLabel) throw new Error(`No termdbs found for genome ${opts.genomeObj.name}`)
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		await appInit({
			holder,
			state: {
				dslabel: scDsLabel,
				genome: opts.genomeObj.name,
				nav: { header_mode: 'hide_search' },
				vocab: { terms: scctTerms }
			},
			tree: {
				vocab: { terms: scctTerms },
				click_term_wrapper: (term: any) => {
					this.callback!(term)
				}
			}
		})
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
	}
}
