import { renderTable } from '#dom'
import type { CategoryKey } from '#types'
import { pickCollectionFraction } from './termCollectionFractionSelection.ts'

export class SearchHandler {
	callback: any
	app: any

	async init(opts) {
		// opts.details is the term object for term collection
		this.callback = opts.callback
		this.app = opts.app

		opts.holder.style('display', '')

		const termlst = opts.details.termlst ?? []
		const memberType = opts.details.memberType || opts.details.type
		if (opts.termCollectionSelectionMode === 'fraction' && memberType === 'numeric') {
			pickCollectionFraction({
				holder: opts.holder,
				term: makeTerm(opts.details, termlst, opts.usecase),
				callback: tw => opts.callback(tw)
			})
			return
		}

		const tableDiv = opts.holder.append('div')
		renderTable({
			columns: [{ label: 'VARIABLES' }],
			rows: termlst.map(t => {
				return [{ value: t.name }]
			}),
			div: tableDiv,
			maxWidth: '30vw',
			maxHeight: '40vh',
			// the button is disabled while the selection cannot be submitted
			noButtonCallback: () => updateSelectBtn(),
			striped: false,
			showHeader: true, //false,
			selectAll: true,
			columnButtons: undefined, //Leave until table.js is typed
			buttons: undefined
		})

		let categoryTable
		let ckSource: CategoryKey[] = []
		if (opts.details.categoryKeys) {
			// later, if there's just one category, simply show a disabled checked box for this category and no longer uncheckable
			ckSource = opts.details.categoryKeys as CategoryKey[]
			const categoryDiv = opts.holder.append('div').style('margin-top', '15px')
			const values = opts.details.termlst[0].values || {}
			categoryTable = categoryDiv.append('div')
			renderTable({
				columns: [{ label: 'CATEGORIES' }],
				rows: ckSource.map((ck: CategoryKey) => {
					return [{ value: values[ck.key]?.label ?? ck.key, checked: ck.shown }]
				}),
				div: categoryTable,
				maxWidth: '30vw',
				maxHeight: '40vh',
				noButtonCallback: () => updateSelectBtn(),
				striped: false,
				showHeader: true, //false,
				selectAll: true,
				columnButtons: undefined, //Leave until table.js is typed
				buttons: undefined
			})
		}

		/** true for each checked row of a rendered table, in row order */
		function getRowChecks(div: any): boolean[] {
			const trs = div.select('table').select('tbody').node().querySelectorAll('tr')
			return [...trs].map((tr: any) => tr.querySelectorAll('td')[1]?.querySelector('input')?.checked === true)
		}
		function getSelectedTermlst() {
			const checked = getRowChecks(tableDiv)
			return termlst.filter((term, i) => checked[i])
		}
		function getCategoryKeys(): CategoryKey[] | undefined {
			if (!categoryTable) return undefined
			const checked = getRowChecks(categoryTable)
			return ckSource.map((ck: CategoryKey, i: number) => ({ key: ck.key, shown: checked[i] }))
		}
		/** The reason the current selection cannot be submitted, or undefined when it can be */
		function getSelectionError(): string | undefined {
			// a lone member is not a collection, e.g. nothing to sum for a fraction or stack in a bar
			if (getSelectedTermlst().length < 2) return 'Select at least two variables.'
			if (getCategoryKeys()?.every(ck => !ck.shown)) return 'Select at least one category.'
			return undefined
		}
		function updateSelectBtn() {
			if (!selectBtn) return
			const error = getSelectionError()
			// a vanilla button is greyed out by the browser when disabled, no styling needed here
			selectBtn.property('disabled', Boolean(error)).attr('title', error || null)
		}

		const selectBtn = opts.holder
			.append('div')
			.style('float', 'right')
			.style('padding', '6px 20px')
			.append('button')
			.attr('data-testid', 'sjpp-term-collection-select')
			.text('Select')
			.on('click', () => {
				opts.callback({
					// makeTerm() extracts propsByTermId (color, etc) for the selected terms
					...makeTerm(opts.details, getSelectedTermlst(), opts.usecase),
					categoryKeys: getCategoryKeys()
				})
			})
		updateSelectBtn()
	}
}

function makeTerm(details: any, termlst: any[], usecase: any) {
	const propsByTermId = {}
	if (details.propsByTermId) {
		for (const term of termlst) {
			if (details.propsByTermId[term.id]) propsByTermId[term.id] = details.propsByTermId[term.id]
		}
	}
	return {
		type: 'termCollection',
		termIds: termlst.map(term => term.id),
		termlst,
		name: details.name,
		valueTransform: details.valueTransformByPlots?.[usecase?.target],
		// memberType = ds.cohort.termdb.termCollections[].type for client code
		memberType: details.memberType || details.type,
		categoryKeys: details.categoryKeys,
		isleaf: true,
		propsByTermId
	}
}
