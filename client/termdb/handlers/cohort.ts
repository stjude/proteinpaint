import { appInit } from '../app'
import { vocabInit } from '../vocabulary'

export class SearchHandler {
	callback: any
	app: any
	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		// determine whether embedder allows retrieval of cohorts
		const allow2getCohorts = this.app.vocabApi.app?.opts?.opts?.allow2getCohorts
		if (!allow2getCohorts) return
		// get all user-built cohorts from embedder
		const cohorts = allow2getCohorts.callback()
		// convert cohorts to terms
		const terms = cohorts.map(cohort => {
			const term = {
				id: cohort.id,
				name: cohort.name,
				type: 'cohort',
				filter0: cohort.filter,
				isleaf: true,
				parent_id: null
			}
			return term
		})

		// build frontend vocab using cohort terms
		const vocabApi = vocabInit({ vocab: { terms } })

		// render cohort terms in termdb tree
		appInit({
			holder,
			vocabApi,
			state: {},
			tree: {
				click_term: term => {
					this.callback(term)
				}
			}
		})
	}
}
