import { renderTable } from '#dom/table'

export const handler = {
	term_name_gen,
	get_pill_label,
	fillMenu
}
async function fillMenu(self, div, tvs) {
	div.selectAll('*').remove()
	div = div.append('div')
	div.style('font-size', '0.8em')
	div.append('div').style('margin', '10px').html(`<b>Select <i>${tvs.term.name}</i> samples:</b>`)
	const rows = []
	for (const field in tvs.term.values) {
		const samples = tvs.term.values[field].list
		for (const sample of samples) rows.push([{ value: sample.sample }])
	}
	const columns = [{ label: 'Sample' }]
	renderTable({
		rows,
		columns,
		div,
		maxWidth: '250px',
		buttons: [
			{
				text: 'APPLY',
				class: 'sjpp_apply_btn sja_filter_tag_btn',
				callback: indexes => {
					const values = []
					for (const index of indexes) values.push(tvs.values[index])
					tvs.values = values
					self.opts.callback(tvs)
				}
			}
		],
		striped: false,
		showHeader: false,
		selectAll: true
	})
}

function term_name_gen(d) {
	const name = 'sample'
	return name
}

function get_pill_label(tvs) {
	return { txt: ` in ${tvs.term.name}` }
}
