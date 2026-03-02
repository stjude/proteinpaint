import { renderTable } from '#dom'

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
			columns: [{ label: 'Terms' }],
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
				const termNames = selectedTermlst.map((o: any) => o.id).join(',')
				const termNamesLabel = `${opts.details.name} (${termNames})`
				const termName = termNamesLabel.length <= 26 ? termNamesLabel : termNamesLabel.slice(0, 26) + '...'
				const propsByTermId = {}
				if (opts.details.propsByTermId) {
					// extract properties (like color, etc) for the selected terms
					for (const t of selectedTermlst) {
						if (opts.details.propsByTermId[t.id]) propsByTermId[t.id] = opts.details.propsByTermId[t.id]
					}
				}

				const termPayload: any = {
					collectionId: opts.details.name,
					type: 'termCollection',
					termIds: selectedTermlst.map(i => i.id),
					termlst: selectedTermlst,
					name: termName,
					memberType: opts.details.type,
					isleaf: true,
					propsByTermId
				}
				if (opts.details.type === 'categorical' && opts.details.categoryKeys) {
					termPayload.categoryKeys = opts.details.categoryKeys
				}
				opts.callback(termPayload)
			})
	}
}
