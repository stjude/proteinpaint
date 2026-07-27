import { renderTable, NumericRangeInput } from '#dom'
import { format_val_text } from './tvs.numeric.js'
import type { TermCollectionTvs } from '#types'
import { validateTermCollectionTvs, getTvsDenominators } from '#shared/filter.js'

const numeratorTestId = 'sjpp-tvs-collection-numerator'
const denominatorTestId = 'sjpp-tvs-collection-denominator'

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

	// Pre-configured collections are registered in termdbConfig.termCollections.
	// Custom collections (e.g. isoform expression collections created dynamically
	// via "Create Collection") are not registered there — they carry their own
	// termlst and memberType directly on the term object.
	let details = self.opts.vocabApi.termdbConfig.termCollections?.find(c => c.name === tvs.term.name)
	if (!details) {
		if (tvs.term.isCustom && tvs.term.termlst?.length) {
			details = { termlst: tvs.term.termlst, type: tvs.term.memberType || 'numeric' }
		} else {
			throw new Error(`No termCollection found for name=${tvs.term.name}`)
		}
	}
	if (details.type !== 'numeric') throw new Error('filter only supports numeric term collection')
	// Render UI after details lookup succeeds so no orphaned input is left on error
	const rangeInput = renderRangeInput(div, tvs, applyRange)
	const getTableData = await addFilterTable({ holder: div, tvs, details, vocabApi: self.opts.vocabApi })

	async function applyRange(tvs) {
		const tvsProps = getTableData()
		if (!tvsProps) return
		// the complete member list stays on the term; the numerator and denominator are
		// explicit id lists, consistent with q of a fraction termCollection tw
		tvs.term.termlst = tvsProps.termlst
		tvs.term.numerators = tvsProps.numerators
		tvs.term.denominators = tvsProps.denominators
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
	// the fraction is on a 0 to 1 scale, same as the value of a fraction termCollection tw
	tr.append('td').text('Fraction 0 to 1')
	const equation_td = tr.append('td')

	range.min = 0
	range.max = 1
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
	const denominators = getTvsDenominators(opts.tvs.term)
	const numerators = opts.tvs.term.numerators?.length ? opts.tvs.term.numerators : denominators

	const rows: any = []
	for (const term of opts.details.termlst) {
		const numeratorChecked = numerators.includes(term.id) ? 'checked' : ''
		const denominatorChecked = denominators.includes(term.id) ? 'checked' : ''
		rows.push([
			{ value: term.name },
			{ html: `<input type='checkbox' data-testid='${numeratorTestId}' ${numeratorChecked} />` },
			{ html: `<input type='checkbox' data-testid='${denominatorTestId}' ${denominatorChecked} />` }
		])
	}
	const selectedRows: number[] = opts.details.termlst
		.map((term, index) => (denominators.includes(term.id) ? index : -1))
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
		const isChecked = (i: number, testid: string) =>
			(trs[i]?.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null)?.checked === true
		const numerators = opts.details.termlst.filter((term, i) => isChecked(i, numeratorTestId)).map(t => t.id)
		const denominators = opts.details.termlst.filter((term, i) => isChecked(i, denominatorTestId)).map(t => t.id)
		try {
			validateTermCollectionTvs(numerators, denominators)
			// every member is kept on the term, only the id lists select the ones in use
			return { numerators, denominators, termlst: opts.details.termlst }
		} catch (e: any) {
			window.alert(e.message)
		}
	}
}

function getSelectRemovePos(j) {
	return j
}

function term_name_gen(d) {
	return `Fraction(${d.term.numerators.join('+')})`
}

function get_pill_label(tvs) {
	return { txt: format_val_text(tvs.ranges[0], tvs.term) }
}
