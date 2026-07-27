import { NumericRangeInput } from '#dom'
import { format_val_text } from './tvs.numeric.js'
import type { TermCollectionTvs } from '#types'
import { validateTermCollectionTvs, getTvsDenominators } from '#shared/filter.js'
import { renderFractionSelection } from '../termdb/handlers/termCollectionFractionSelection.ts'

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
	// the chooser updates tvs.term.numerators[]/denominators[] in place, on a cloned tvs
	const validateSelection = await addFilterTable({ holder: div, tvs, details, vocabApi: self.opts.vocabApi })

	async function applyRange(tvs) {
		if (!validateSelection()) return
		self.dom.tip.hide()
		self.opts.callback({ term: tvs.term, ranges: [rangeInput.getRange()] })
	}
}

function renderRangeInput(div, tvs, applyRange) {
	const savedRange = tvs.ranges?.[0] || tvs.term.range
	// a new filter starts at a nonzero fraction, instead of an unset range
	const range = savedRange || { start: 0.1, startinclusive: false, stopunbounded: true }
	const num_div = div.append('div').style('display', 'flex').style('align-items', 'center').style('column-gap', '5px')
	// the fraction is on a 0 to 1 scale, same as the value of a fraction termCollection tw
	num_div.append('span').text('Fraction 0 to 1')

	range.min = 0
	range.max = 1
	// the input fires 'change' when it loses focus with an edited value, e.g. on clicking a
	// checkbox in the member table below. So it may only parse the entry: applying the filter
	// closes the menu, and must be left to the APPLY button.
	const rangeInput = new NumericRangeInput(num_div, range, () => {})

	num_div
		.append('button')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.text('APPLY')
		.on('click', () => {
			try {
				rangeInput.parseRange()
			} catch (e: any) {
				return window.alert(e)
			}
			applyRange(tvs)
		})

	return rangeInput
}

/* Render the numerator/denominator chooser of the filtered collection. The tvs term is the
selection object: its numerators[] and denominators[] are updated in place as checkboxes
change, so the term is ready to apply as is.

opts.details = a termCollections entry in dataset.cohort.termdb (a term obj)
Returns a function that validates the current selection, alerting the user when it cannot
be applied. */
export async function addFilterTable(opts): Promise<() => boolean> {
	const term = opts.tvs.term
	// resolve the denominator before replacing termlst[]: a filter saved before
	// term.denominators[] existed implied it from a pruned termlst[]
	term.denominators = getTvsDenominators(term)
	// only the first member by default: every member as numerator makes the fraction a constant 1
	if (!term.numerators?.length) term.numerators = term.denominators.slice(0, 1)
	// every member of the collection is kept on the term, only the id lists select the ones in use
	term.termlst = opts.details.termlst

	renderFractionSelection({
		holder: opts.holder,
		selection: term,
		propsByTermId: term.propsByTermId
	})

	return () => {
		try {
			validateTermCollectionTvs(term)
			return true
		} catch (e: any) {
			window.alert(e.message)
			return false
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
