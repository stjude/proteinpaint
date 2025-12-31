import { appInit } from '../app.ts'
import { TermTypes } from '#shared/terms.js'

export class SearchHandler {
	callback: any
	app: any
	async init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const details = this.app.vocabApi.termdbConfig.numericTermCollections.reduce(
			(acc, item, i) => ({
				name: i === 0 ? item.name : acc.name + '/' + item.name,
				termIds: [...acc.termIds, ...item.termIds],
				branchIds: [...acc.branchIds, ...item.branchIds]
			}),
			{ name: '', termIds: [], branchIds: [] }
		)
		const usecase = {
			target: 'numericTermCollections',
			detail: { ...details }
		}
		const selectedTerms = new Set()
		const innerTree = await appInit({
			holder: opts.holder,
			vocabApi: this.app.vocabApi,
			focus: 'off',
			state: {
				nav: { header_mode: 'search_only' },
				tree: { usecase, expandedTermIds: details.branchIds }
			},
			tree: {
				click_term: (term: any) => {
					if (selectedTerms.has(term)) selectedTerms.delete(term)
					else selectedTerms.add(term)
					innerTree.dispatch({
						type: 'app_refresh',
						state: {
							selectedTerms: [...selectedTerms]
						}
					})
					//copts.callback(term)
					opts.callback({
						selectedTerms,
						type: TermTypes.TERM_COLLECTION,
						name: usecase.detail.name == 'Mutation Signature' ? `% SNVs` : `Percentage`
					})
				}
			},
			search: {
				focus: 'off'
			}
		})
	}
}
