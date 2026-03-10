import { renderTable, NumericRangeInput } from '#dom'
import { format_val_text } from './tvs.numeric.js'
import type { TermCollectionTvs } from '#types'
import { validateTermCollectionTvs } from '#shared/filter.js'

export const handler = {
	type: 'termCollection',
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
	tvs = structuredClone(tvs)
	div.selectAll('*').remove()
	div = div.append('div').style('font-size', '0.8em')

	const rangeInput = renderRangeInput(div, tvs, applyRange)
	const details = self.opts.vocabApi.termdbConfig.termCollections?.find(c => c.name === tvs.term.name)
	if (!details) throw new Error(`No termCollection found for name=${tvs.term.name}`)
	if (details.type !== 'numeric') throw new Error('filter only supports numeric term collection')
	const getTableData = await addFilterTable({ holder: div, tvs, details, vocabApi: self.opts.vocabApi })

	async function applyRange(tvs) {
		const tvsProps = getTableData()
		if (!tvsProps) return
		tvs.term.termlst = tvsProps.termlst
		tvs.term.numerators = tvsProps.numerators // tvs.term.termlst.filter(term => term.checked).map(t => t.id)
		self.dom.tip.hide()
		self.opts.callback({ term: tvs.term, ranges: [rangeInput.getRange()] })
	}
}

function renderRangeInput(div, tvs, applyRange) {
	const termrange = tvs.term.range || {}
	const range = tvs.ranges && tvs.ranges[0] ? tvs.ranges[0] : termrange
	const num_div = div.append('div')
	num_div.selectAll('*').remove()
	const table = num_div.append('table')
	const tr = table.append('tr')
	tr.append('td').text('Percentage 0 to 100')
	const equation_td = tr.append('td')

	range.min = 0
	range.max = 100
	const rangeInput = new NumericRangeInput(equation_td, range, () => applyRange(tvs))

	tr.append('td')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin', '5px')
		.style('margin-left', '10px')
		.style('text-align', 'center')
		.style('font-size', '.8em')
		.text('APPLY')
		.on('click', async () => {
			rangeInput.parseRange()
		})

	return rangeInput
}

// opts.details = a termCollections entry in dataset.cohort.termdb (a term obj)
export async function addFilterTable(opts): Promise<any> {
	if (!opts.tvs.term.numerators) opts.tvs.term.numerators = opts.tvs.term.termlst.map(t => t.id)

	const termlst = opts.tvs.term.termlst || []
	const numerators = opts.tvs.term.numerators || []

	const rows: any = []
	for (const term of opts.details.termlst) {
		const numeratorChecked = numerators?.find(tid => tid === term.id) ? 'checked' : ''
		const denominatorChecked = opts.tvs.term.termlst.find(t => t.id === term.id) ? 'checked' : ''
		rows.push([
			{ value: term.name },
			{ html: `<input type='checkbox' ${numeratorChecked} />` },
			{ html: `<input type='checkbox' ${denominatorChecked} />` }
		])
	}
	const selectedRows: number[] = opts.details.termlst
		.map((term, index) => (termlst.find(t => t.id === term.id) ? index : -1))
		.filter(index => index !== -1)

	const columns: any = [{ label: 'Variables' }, { label: 'Use in numerator' }, { label: 'Use in denominator' }]

	const tableDiv = opts.holder.append('div')

	// cannot use table button callback as it cannot manage two sets of custom checkboxes
	renderTable({
		rows,
		columns,
		div: tableDiv,
		maxWidth: '30vw',
		maxHeight: '40vh',
		striped: false,
		showHeader: true,
		selectedRows,
		columnButtons: undefined,
		buttons: undefined
	})

	return () => {
		const trs = tableDiv.select('table').select('tbody').node().querySelectorAll('tr')
		const numerators = opts.details.termlst
			.filter((term, i) => {
				const checked = trs[i].querySelectorAll('td')[2].querySelector('input')?.checked
				return checked === true
			})
			.map(t => t.id)
		const termlst = opts.details.termlst.filter((term, i) => {
			const checked = trs[i].querySelectorAll('td')[3].querySelector('input')?.checked
			return checked === true
		})
		try {
			validateTermCollectionTvs(
				numerators,
				termlst.map(i => i.id)
			)
			return { numerators, termlst }
		} catch (e) {
			window.alert(e.message)
		}
	}
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
