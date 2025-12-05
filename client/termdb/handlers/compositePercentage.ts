import { appInit } from '../app.ts'

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
			detail: { type: 'compositePercentage', ...details }
		}
		await appInit({
			holder: opts.holder,
			vocabApi: this.app.vocabApi,
			focus: 'off',
			state: {
				nav: { header_mode: 'search_only' },
				tree: { usecase }
			},
			tree: {
				submit_lst: async termlst => {
					const termNames = termlst.map(o => o.id).join(',')
					const termName = usecase.detail.name == 'Mutation Signature' ? `% SNVs (${termNames})` : 'percentage'
					const term = { name: termName, type: 'compositePercentage', isleaf: true, termlst }
					this.callback(term)
				}
				// click_term: (term: any) => {
				// 	term.forComPer = true
				// 	this.callback(term)
				// }
			},
			search: {
				focus: 'off'
			}
		})
	}
}
