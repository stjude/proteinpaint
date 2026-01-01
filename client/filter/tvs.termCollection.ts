import { renderTable } from '../dom/table'
import { NumericRangeInput } from '#dom/numericRangeInput'
import { format_val_text } from './tvs.numeric.js'
import { mayHydrateDictTwLst } from '#termsetting'
import type { TermCollectionTvs } from '#types'

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

async function fillMenu(self, div, tvs: TermCollectionTvs) {
	tvs = JSON.parse(JSON.stringify(tvs))
	div.selectAll('*').remove()
	div = div.append('div')
	div.style('font-size', '0.8em')

	const brush = renderRangeInput(div, tvs, applyRange)
	const details = self.opts.vocabApi.termdbConfig.numericTermCollections.find(c => c.name === tvs.term.collectionId)
	const getTableData = await addFilterTable({ holder: div, tvs, details, vocabApi: self.opts.vocabApi })

	async function applyRange(tvs) {
		const tvsProps = getTableData()
		tvs.term.termlst = tvsProps.termlst
		tvs.term.numerators = tvsProps.numerators // tvs.term.termlst.filter(term => term.checked).map(t => t.id)
		self.dom.tip.hide()
		self.opts.callback({ term: tvs.term, ranges: [brush.rangeInput.getRange()] })
	}
}

function renderRangeInput(div, tvs, applyRange) {
	const termrange = tvs.term.range || {}
	const range = tvs.ranges && tvs.ranges[0] ? tvs.ranges[0] : termrange
	const num_div = div.append('div')
	num_div.selectAll('*').remove()
	const brush: any = {}
	const table = num_div.append('table')
	const tr = table.append('tr')
	tr.append('td').html('Percentage range')
	brush.equation_td = tr.append('td')

	range.min = 0
	range.max = 100
	brush.rangeInput = new NumericRangeInput(brush.equation_td, range, () => applyRange(tvs))

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

	return brush
}

// details = a numericTermCollections entry in dataset.cohort.termdb
export async function addFilterTable(opts): Promise<any> {
	const terms: any[] = []
	const toBeHydrated: any[] = []

	for (const id of opts.details.termIds) {
		// const term = self.term.termlst.find(t => t.id === id)
		// if (term) terms.push(term)
		// else
		toBeHydrated.push({ id })
	}
	if (toBeHydrated.length) {
		await mayHydrateDictTwLst(toBeHydrated, opts.vocabApi)
		terms.push(...toBeHydrated.map(tw => tw.term))
	}
	if (!opts.tvs.term.numerators) opts.tvs.term.numerators = opts.tvs.term.termlst.map(t => t.id)

	const termlst = opts.tvs.term.termlst || []
	const numerators = opts.tvs.term.numerators || []

	const rows: any = []
	for (const term of terms) {
		const numeratorChecked = numerators?.find(tid => tid === term.id) ? 'checked' : ''
		const denominatorChecked = opts.tvs.term.termlst.find(t => t.id === term.id) ? 'checked' : ''
		rows.push([
			{ value: term.name },
			{ html: `<input type='checkbox' ${numeratorChecked} />` },
			{ html: `<input type='checkbox' ${denominatorChecked} />` }
		])
	}
	const selectedRows: number[] = terms
		.map((term, index) => (termlst.find(t => t.id === term.id) ? index : -1))
		.filter(index => index !== -1)

	const columns: any = [{ label: 'Terms' }, { label: 'Use as numerator' }, { label: 'Use as denominator' }]

	const tableDiv = opts.holder.append('div')

	renderTable({
		rows,
		columns,
		div: tableDiv,
		maxWidth: '30vw',
		maxHeight: '40vh',
		//noButtonCallback,
		striped: false,
		showHeader: true, //false,
		selectedRows,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})

	return () => {
		const trs = tableDiv.select('table').select('tbody').node().querySelectorAll('tr')
		// console.log(132, trs, opts.callback, opts)
		return {
			termlst: terms.filter((term, i) => {
				const checked = trs[i].querySelectorAll('td')[3].querySelector('input')?.checked
				return checked === true
			}),
			numerators: terms
				.filter((term, i) => {
					const checked = trs[i].querySelectorAll('td')[2].querySelector('input')?.checked
					return checked === true
				})
				.map(t => t.id)
		}
	}
}

// export function addTable(div, tvs) {
// 	div
// 		.style('padding', '6px')
// 		.append('div')
// 		.style('margin', '10px')
// 		.style('font-size', '0.8rem')
// 		.html(`<b> Select terms whose combined percentage will be used as the filter</b>.`)

// 	const termlst = tvs.term.termlst
// 	const rows = []
// 	for (const term of termlst) rows.push([{ value: term.id }])

// 	const selectedRows = termlst.map((term, index) => (term.checked ? index : -1)).filter(index => index !== -1)
// 	const columns = [{ label: 'Term' }]
// 	renderTable({
// 		rows,
// 		columns,
// 		div,
// 		maxWidth: '30vw',
// 		maxHeight: '40vh',
// 		noButtonCallback: (index, node) => {
// 			termlst[index].checked = node.checked
// 		},
// 		striped: false,
// 		showHeader: false,
// 		selectedRows
// 	})
// }

function getSelectRemovePos(j) {
	return j
}

function term_name_gen(d) {
	return `Percentage(${d.term.numerators.join('+')})`
}

function get_pill_label(tvs) {
	return { txt: format_val_text(tvs.ranges[0], tvs.term) }
}
