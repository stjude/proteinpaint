import { mayHydrateDictTwLst } from '#termsetting'
import { renderTable } from '../../dom/table.ts'

export class SearchHandler {
	callback: any
	app: any

	async init(opts) {
		this.callback = opts.callback
		this.app = opts.app

		const terms: any[] = []
		const toBeHydrated: any[] = []
		for (const id of opts.details.termIds) {
			toBeHydrated.push({ id })
		}
		if (toBeHydrated.length) {
			await mayHydrateDictTwLst(toBeHydrated, opts.app.vocabApi)
			terms.push(...toBeHydrated.map(tw => tw.term))
		}

		const termlst: any[] = []
		const rows: any[] = []

		for (const term of terms) {
			rows.push([{ value: term.name }])
		}

		const selectedRows: number[] = terms
			.map((term, index) => (termlst.find(t => t.id === term.id) ? index : -1))
			.filter(index => index !== -1)

		const columns: any = [{ label: 'Terms' }]

		opts.holder.style('display', '')
		const tableDiv = opts.holder.append('div')

		renderTable({
			rows,
			columns,
			div: tableDiv,
			maxWidth: '30vw',
			maxHeight: '40vh',
			noButtonCallback: () => {},
			striped: false,
			showHeader: true, //false,
			selectedRows,
			columnButtons: undefined, //Leave until table.js is typed
			buttons: undefined
		})

		opts.holder
			.append('div')
			.style('float', 'right')
			.style('padding', '6px 20px')
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
			.text('Select')
			.on('click', () => {
				const trs = tableDiv.select('table').select('tbody').node().querySelectorAll('tr')
				const termlst = terms.filter((term, i) => {
					const checked = trs[i].querySelectorAll('td')[1].querySelector('input')?.checked
					return checked === true
				})
				const termNames = termlst.map((o: any) => o.id).join(',')
				const termNamesLabel = `${name} (${termNames})`
				const termName = termNamesLabel.length <= 26 ? termNamesLabel : termNamesLabel.slice(0, 26) + '...'
				const propsByTermId = {}
				if (opts.details.propsByTermId) {
					// extract properties (like color, etc) for the selected terms
					for (const t of termlst) {
						if (opts.details.propsByTermId[t.id]) propsByTermId[t.id] = opts.details.propsByTermId[t.id]
					}
				}

				opts.callback({
					collectionId: opts.details.name,
					type: 'termCollection',
					termlst,
					name: termName,
					isleaf: true,
					propsByTermId
				})
			})
	}
}
