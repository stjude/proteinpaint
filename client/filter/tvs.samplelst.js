import { renderTable } from '#dom/table'

export const handler = {
	term_name_gen,
	get_pill_label,
	fillMenu,
	getSelectRemovePos
}
async function fillMenu(self, div, tvs) {
	tvs = JSON.parse(JSON.stringify(tvs))
	div.selectAll('*').remove()
	div = div.append('div')
	div.style('font-size', '0.8em')
	const rows = []
	let samples, name
	for (const field in tvs.term.values) {
		name = field
		samples = tvs.term.values[field].list //Only two possible groups and the second one contains the samples not in the first one
		addTable(div, tvs, field)
		break
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

				if (!firstGroup) {
					firstGroup = field
					value.list = value.list.filter(s => !('checked' in s) || s.checked)
				} else value.list = tvs.term.values[firstGroup].list //not in group
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

function term_name_gen(d) {
	return getGroupLabel(d.term)
}

function get_pill_label(tvs) {
	const label = getGroupLabel(tvs.term)
	return { txt: `${tvs.isnot ? 'NOT' : ''} ${label}` }
}

function getGroupLabel(term) {
	let n, group
	for (const item in term.values) {
		n = term.values[item].list.length
		group = item
		break
	}
	return `samples in ${group} n=${n}`
}
