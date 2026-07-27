import { renderTable } from '#dom'
import { TermTypes, termItemType } from '#shared/terms.js'
import type { RawTermCollectionTWFraction } from '#types'

export type TermCollectionSelectionMode = 'fraction'

const numeratorTestId = 'sjpp-term-collection-numerator'
const denominatorTestId = 'sjpp-term-collection-denominator'

/** The numerator and denominator member ids of a term collection fraction, updated in place
 *  by renderFractionSelection(). Either q{} of a fraction tw, or a termCollection tvs term;
 *  the latter also carries the member list as termlst[]. */
export type FractionSelection = {
	termlst?: any[]
	numerators?: string[]
	denominators?: string[]
}

type RowInputs = { numerator: HTMLInputElement | null; denominator: HTMLInputElement | null }

/** Collect the numerator and denominator input of each rendered row, in termlst[] order */
function getRowInputs(tableDiv: any): RowInputs[] {
	const trs = tableDiv.select('tbody').node()?.querySelectorAll('tr') || []
	return [...trs].map((tr: HTMLElement) => ({
		numerator: tr.querySelector(`[data-testid="${numeratorTestId}"]`),
		denominator: tr.querySelector(`[data-testid="${denominatorTestId}"]`)
	}))
}

/** Selection to start a newly picked collection with: every member in the denominator and
 *  only the first in the numerator, so that the fraction is not a constant 1. */
export function getDefaultFractionSelection(termlst: any[]): FractionSelection {
	if (!termlst?.length) throw new Error('Cannot configure a fraction from an empty term collection')
	return { numerators: [termlst[0].id], denominators: termlst.map(term => term.id) }
}

/** The reason a selection cannot be applied, or undefined when it can be */
export function getFractionSelectionError(selection: FractionSelection): string | undefined {
	if (!selection.denominators?.length) return 'Select at least one denominator.'
	if (!selection.numerators?.length) return 'Select at least one numerator.'
	if (selection.numerators.some(id => !selection.denominators!.includes(id)))
		return 'Every numerator must also be selected as a denominator.'
	return undefined
}

/**
 * Render the numerator/denominator chooser of a numeric term collection: one row per member,
 * with a checkbox for each of the two roles. A member may only be a numerator when it is also
 * a denominator, so deselecting a denominator clears and disables the row's numerator.
 *
 * opts.selection is updated in place on every change, so the caller only reads it when its
 * own apply button is clicked. All members are always listed: the selection is expressed by
 * the two id lists, never by pruning the member list.
 */
export function renderFractionSelection(opts: {
	holder: any
	/** updated in place: q{} of a fraction tw, or a termCollection tvs term */
	selection: FractionSelection
	/** members to list, defaults to selection.termlst[] */
	termlst?: any[]
	/** member colors, e.g. term.propsByTermId */
	propsByTermId?: { [termId: string]: { color?: string } }
	/** called after every change, e.g. to update an apply button */
	onChange?: () => void
}) {
	const { selection } = opts
	const termlst = opts.termlst || selection.termlst || []
	if (!termlst.length) throw new Error('Cannot configure a fraction from an empty term collection')

	const tableDiv = opts.holder.append('div').attr('data-testid', 'sjpp-term-collection-fraction-selection')
	const isNumerator = (term: any) => selection.numerators?.includes(term.id) === true
	const isDenominator = (term: any) => selection.denominators?.includes(term.id) === true
	const rows = termlst.map(term => [
		{},
		{
			html: `<input type="checkbox" data-testid="${numeratorTestId}" ${isNumerator(term) ? 'checked' : ''} ${
				isDenominator(term) ? '' : 'disabled'
			}/>`
		},
		{ html: `<input type="checkbox" data-testid="${denominatorTestId}" ${isDenominator(term) ? 'checked' : ''}/>` }
	])

	renderTable({
		columns: [
			{
				label: termItemType(termlst[0]),
				fillCell: (td: any, index: number) => fillTermNameCell(td, termlst[index], opts.propsByTermId)
			},
			{ label: 'Numerator' },
			{ label: 'Denominator' }
		],
		rows,
		div: tableDiv,
		maxWidth: '40vw',
		maxHeight: '40vh',
		striped: false,
		showHeader: true,
		columnButtons: undefined,
		buttons: undefined
	})

	const inputs = getRowInputs(tableDiv)
	const updateSelection = () => {
		selection.denominators = termlst.filter((_, i) => inputs[i]?.denominator?.checked === true).map(term => term.id)
		selection.numerators = termlst.filter((_, i) => inputs[i]?.numerator?.checked === true).map(term => term.id)
		opts.onChange?.()
	}
	for (const { numerator, denominator } of inputs) {
		if (!numerator || !denominator) continue
		denominator.addEventListener('change', () => {
			// a member may only be a numerator when it is also a denominator
			numerator.disabled = !denominator.checked
			if (!denominator.checked) numerator.checked = false
			updateSelection()
		})
		numerator.addEventListener('change', updateSelection)
	}
}

function fillTermNameCell(td: any, term: any, propsByTermId?: { [termId: string]: { color?: string } }) {
	const color = propsByTermId?.[term.id]?.color || term.color
	if (color) {
		td.append('span')
			.attr('data-testid', 'sjpp-term-collection-member-color')
			.style('display', 'inline-block')
			.style('width', '10px')
			.style('height', '10px')
			.style('margin-right', '5px')
			.style('background-color', color)
	}
	td.append('span').text(term.name || term.id)
}

/** Render the chooser for a newly picked collection, with a button to submit it as a
 *  fraction tw. Used where a collection is selected, e.g. term search and the term tree. */
export function pickCollectionFraction(opts: {
	holder: any
	term: any
	buttonLabel?: string
	callback: (tw: RawTermCollectionTWFraction) => void
}) {
	const { term } = opts
	const selection = getDefaultFractionSelection(term.termlst)
	renderFractionSelection({
		holder: opts.holder,
		termlst: term.termlst,
		selection,
		propsByTermId: term.propsByTermId
	})

	opts.holder
		.append('div')
		.style('padding', '6px 20px')
		.append('button')
		.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
		.attr('data-testid', 'sjpp-term-collection-fraction-select')
		.text(opts.buttonLabel || 'Select')
		.on('click', () => {
			const error = getFractionSelectionError(selection)
			if (error) return window.alert(error)
			opts.callback(makeFractionTermWrapper(term, selection))
		})
}

/**
 * Show the fraction chooser in place of a list of selectable terms, when both the use case
 * (selectionMode) and the clicked term require reducing a collection to a scalar fraction.
 * Returns true when the chooser is shown, in which case the caller must not fire its own
 * selection callback: the callback here is called instead, once the user submits a selection.
 */
export function mayRenderFractionSelection(opts: {
	term: any
	selectionMode?: TermCollectionSelectionMode
	/** hidden, not destroyed, while the chooser is shown, so that the user may back out of it */
	listDiv: any
	/** holds the chooser, must be a sibling of listDiv */
	fractionDiv: any
	callback: (tw: RawTermCollectionTWFraction) => void
}): boolean {
	const { term, listDiv, fractionDiv, callback } = opts
	if (opts.selectionMode !== 'fraction') return false
	if (term?.type !== TermTypes.TERM_COLLECTION || term.memberType !== 'numeric') return false
	if (!term.termlst?.length) return false

	fractionDiv.selectAll('*').remove()
	listDiv.style('display', 'none')
	fractionDiv.style('display', '')
	fractionDiv
		.append('div')
		.append('button')
		.attr('data-testid', 'sjpp-term-collection-fraction-back')
		.text('« Back')
		.on('click', () => {
			fractionDiv.style('display', 'none').selectAll('*').remove()
			listDiv.style('display', '')
		})
	pickCollectionFraction({ holder: fractionDiv, term, callback })
	return true
}

export function makeFractionTermWrapper(term: any, selection: FractionSelection): RawTermCollectionTWFraction {
	return {
		type: 'TermCollectionTWFraction' as const,
		term,
		q: {
			mode: 'continuous',
			numerators: selection.numerators!,
			denominators: selection.denominators!
		}
	}
}
