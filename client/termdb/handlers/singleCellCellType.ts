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
		for (const t of scctTerms) {
			holder
				.append('div')
				.text(t.name + '(handler)')
				.on('click', () => {
					this.callback!(t)
				})
		}
	}

	validateOpts(opts) {
		if (opts.callback == null) throw new Error('callback is required')
		if (opts.app == null) throw new Error('app is required')
		if (opts.holder == null) throw new Error('holder is required')
	}
}
