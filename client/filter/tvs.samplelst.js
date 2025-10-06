import { renderTable } from '../dom/table'

export const handler = {
	term_name_gen,
	get_pill_label,
	fillMenu,
	getSelectRemovePos,
	getNegateText(self) {
		return self.tvs.isnot ? 'NOT IN' : 'IN'
	}
}
async function fillMenu(self, div, tvs) {
	tvs = JSON.parse(JSON.stringify(tvs))
	div.selectAll('*').remove()
	div = div.append('div')
	div.style('font-size', '0.8em')
	for (const field in tvs.term.values) {
		if (tvs.term.values[field].in === false) continue
		addTable(div, tvs, field)
	}
	div
		.append('div')
		.append('div')
		.style('display', 'inline-block')
		.style('float', 'right')
		.style('padding', '6px 20px')
		.append('button')
		.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
		.text('Apply')
		.on('click', () => {
			let firstGroup
			for (const field in tvs.term.values) {
				const value = tvs.term.values[field]

				value.list = value.list.filter(s => !('checked' in s) || s.checked)
			}
			self.opts.callback(tvs)
		})
}

export function addTable(div, tvs, field) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${field}</b>.`)

	const value = tvs.term.values[field]
	const rows = []
	for (const sample of value.list) rows.push([{ value: sample.sample }])
	const columns = [{ label: 'Sample' }]
	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback: (index, node) => {
			value.list[index].checked = node.checked
		},
		striped: false,
		showHeader: false,
		selectAll: true
	})
}
function getSelectRemovePos(j) {
	return j
}

function term_name_gen() {
	return 'Samples'
}

function get_pill_label(tvs) {
	return { txt: getGroupLabel(tvs.term) }
}

function getGroupLabel(term) {
	let n = 0
	for (const item in term.values) {
		if (term.values[item].in === false) continue
		n += term.values[item].list.length
	}
	return `${term.name} n=${n}`
}
