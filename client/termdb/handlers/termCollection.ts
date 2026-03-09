import { renderTable } from '#dom'
import type { CategoryKey } from '#types'

export class SearchHandler {
	callback: any
	app: any

	async init(opts) {
		// opts.details is the term object for term collection
		this.callback = opts.callback
		this.app = opts.app

		opts.holder.style('display', '')
		const tableDiv = opts.holder.append('div')

		const termlst = opts.details.termlst ?? []
		renderTable({
			columns: [{ label: 'VARIABLES' }],
			rows: termlst.map(t => {
				return [{ value: t.name }]
			}),
			div: tableDiv,
			maxWidth: '30vw',
			maxHeight: '40vh',
			noButtonCallback: () => {}, // FIXME to supply a real callback
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
				noButtonCallback: () => {}, // FIXME to supply a real callback
				striped: false,
				showHeader: true, //false,
				selectAll: true,
				columnButtons: undefined, //Leave until table.js is typed
				buttons: undefined
			})
		}

		// FIXME backward code!!!!
		opts.holder
			.append('div')
			.style('float', 'right')
			.style('padding', '6px 20px')
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
			.text('Select')
			.on('click', () => {
				const trs = tableDiv.select('table').select('tbody').node().querySelectorAll('tr')
				const selectedTermlst = termlst.filter((term, i) => {
					const checked = trs[i]?.querySelectorAll('td')[1]?.querySelector('input')?.checked
					return checked === true
				})
				if (selectedTermlst.length === 0) {
					alert('Please select at least one term')
					return
				}
				const propsByTermId = {}
				if (opts.details.propsByTermId) {
					// extract properties (like color, etc) for the selected terms
					for (const t of selectedTermlst) {
						if (opts.details.propsByTermId[t.id]) propsByTermId[t.id] = opts.details.propsByTermId[t.id]
					}
				}

				let categoryKeys
				if (categoryTable) {
					const trs = categoryTable.select('table').select('tbody').node().querySelectorAll('tr')
					categoryKeys = ckSource.map((ck: CategoryKey, i: number) => {
						const checked = trs[i].querySelectorAll('td')[1].querySelector('input')?.checked
						return { key: ck.key, shown: !!checked }
					})
				}

				opts.callback({
					type: 'termCollection',
					termIds: selectedTermlst.map(i => i.id),
					termlst: selectedTermlst,
					name: opts.details.name,
					// memberType = ds.cohort.termdb.termCollections[].type for client code
					memberType: opts.details.memberType || opts.details.type,
					categoryKeys,
					isleaf: true,
					propsByTermId
				})
			})
	}
}
