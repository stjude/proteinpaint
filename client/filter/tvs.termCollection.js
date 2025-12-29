import { renderTable } from '../dom/table'
import { NumericRangeInput } from '#dom/numericRangeInput'
import { format_val_text } from './tvs.numeric.js'

export const handler = {
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

function setTvsDefaults(tvs) {
	if (!tvs.ranges) tvs.ranges = []
}

async function fillMenu(self, div, tvs) {
	tvs = JSON.parse(JSON.stringify(tvs))
	div.selectAll('*').remove()
	div = div.append('div')
	div.style('font-size', '0.8em')

	addTable(div, tvs)

	const termrange = tvs.term.range || {}
	const range = tvs.ranges && tvs.ranges[0] ? tvs.ranges[0] : termrange
	const num_div = div.append('div')
	num_div.selectAll('*').remove()
	const brush = {}
	const table = num_div.append('table')
	const tr = table.append('tr')
	tr.append('td').html('Percentage range')
	brush.equation_td = tr.append('td')

	range.min = 0
	range.max = 100
	brush.rangeInput = new NumericRangeInput(brush.equation_td, range, applyRange)

	brush.apply_btn = tr
		.append('td')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin', '5px')
		.style('margin-left', '10px')
		.style('text-align', 'center')
		.style('font-size', '.8em')
		.style('text-transform', 'uppercase')
		.text('apply')
		.on('click', async () => {
			brush.rangeInput.parseRange()
		})

	function applyRange() {
		tvs.term.numerators = tvs.term.termlst.filter(term => term.checked).map(t => t.id)
		self.dom.tip.hide()
		self.opts.callback({ term: tvs.term, ranges: [brush.rangeInput.getRange()] })
	}
}

export function addTable(div, tvs) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> Select terms whose combined percentage will be used as the filter</b>.`)

	const termlst = tvs.term.termlst
	const rows = []
	for (const term of termlst) rows.push([{ value: term.id }])

	const selectedRows = termlst.map((term, index) => (term.checked ? index : -1)).filter(index => index !== -1)
	const columns = [{ label: 'Term' }]
	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback: (index, node) => {
			termlst[index].checked = node.checked
		},
		striped: false,
		showHeader: false,
		selectedRows
	})
}

function getSelectRemovePos(j) {
	return j
}

function term_name_gen(d) {
	return `Percentage(${d.term.numerators.join('+')})`
}

function get_pill_label(tvs) {
	return { txt: format_val_text(tvs.ranges[0], tvs.term) }
}
