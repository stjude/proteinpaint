
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
	div
		.append('div')
		.style('margin', '10px')
		.html(`<b>Select <i>${tvs.term.name}</i> samples:</b>`)
	const rows = []
	for (const value of tvs.values) rows.push([{ value: value }])
	const columns = [{ label: 'Sample' }]
	renderTable({
		rows,
		columns,
		div,
		style: { max_width: '250px' },
		buttons: [
			{
				text: 'APPLY',
				class: 'apply_btn sja_filter_tag_btn',
				callback: indexes => {
					const values = []
					for (const index of indexes) values.push(tvs.values[index])
					tvs.values = values
					self.opts.callback(tvs)
				}
			}
		],
		striped: false,
		showHeader: false
	})
}

function term_name_gen(d) {
	const name = 'sample'
	return name
}

function get_pill_label(tvs) {
	return { txt: ` in ${tvs.term.name}` }
}
