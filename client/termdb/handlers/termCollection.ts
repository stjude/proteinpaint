import { appInit } from '../app.ts'

export class SearchHandler {
	callback: any
	app: any
	async init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const details = opts.details
		const usecase = {
			target: 'numericTermCollections',
			detail: { ...details }
		}
		const selectedTerms = new Set()
		opts.holder.style('display', '')
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

					// this data is for outer tree
					const name = usecase.detail.name == 'Mutation Signature' ? `% SNVs` : `Percentage`
					const termlst: any[] = [...selectedTerms]
					const termNames = termlst.map((o: any) => o.id).join(',')
					const termNamesLabel = `${name} (${termNames})`
					const termName = termNamesLabel.length <= 26 ? termNamesLabel : termNamesLabel.slice(0, 26) + '...'
					const propsByTermId = {}
					if (details.propsByTermId) {
						// extract properties (like color, etc) for the selected terms
						for (const t of termlst) {
							if (details.propsByTermId[t.id]) propsByTermId[t.id] = details.propsByTermId[t.id]
						}
					}
					const newTerm = {
						collectionId: details.name,
						name: termName,
						type: 'termCollection',
						isleaf: true,
						termlst,
						propsByTermId
					}
					opts.callback(newTerm)
				}
			},
			search: {
				focus: 'off'
			}
		})
	}
}
