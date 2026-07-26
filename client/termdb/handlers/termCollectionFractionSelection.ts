import { renderTable } from '#dom'
import type { RawTermCollectionTWFraction } from '#types'

export type TermCollectionSelectionMode = 'fraction'

type RowInputs = { denominator: HTMLInputElement | null; numerator: HTMLInputElement | null }

/** Collect the denominator (renderTable's own checkbox) and numerator input of each rendered row */
function getRowInputs(tableDiv: any): RowInputs[] {
	const trs = tableDiv.select('tbody').node()?.querySelectorAll('tr') || []
	return [...trs].map((tr: HTMLElement) => ({
		denominator: tr.querySelector('input[type="checkbox"]:not([data-testid="sjpp-term-collection-numerator"])'),
		numerator: tr.querySelector('[data-testid="sjpp-term-collection-numerator"]')
	}))
}

/**
 * Render the initial numerator/denominator chooser for a numeric collection.
 * All members remain on the term; the two returned ID lists only configure q.
 */
export function renderFractionSelection(opts: {
	holder: any
	termlst: any[]
	callback: (selection: { numerators: string[]; denominators: string[] }) => void
	buttonLabel?: string
}) {
	const { holder, termlst, callback } = opts
	if (!termlst.length) throw new Error('Cannot configure a fraction from an empty term collection')

	const tableDiv = holder.append('div').attr('data-testid', 'sjpp-term-collection-fraction-selection')
	// the numerator selection is tracked here instead of being read back from the DOM only:
	// renderTable's check-all toggles every <input> under tbody, including these checkboxes
	const numeratorIds = new Set<string>([termlst[0].id])
	const rows = termlst.map((term, index) => [
		{ value: term.name || term.id },
		{
			html: `<input type="checkbox" data-testid="sjpp-term-collection-numerator" ${index === 0 ? 'checked' : ''}/>`
		}
	])
	// a member may only be a numerator if it is also a denominator
	const syncNumerators = () => {
		for (const [i, { denominator, numerator }] of getRowInputs(tableDiv).entries()) {
			if (!denominator || !numerator) continue
			if (!denominator.checked) numeratorIds.delete(termlst[i].id)
			numerator.disabled = !denominator.checked
			numerator.checked = numeratorIds.has(termlst[i].id)
		}
	}

	renderTable({
		columns: [{ label: 'VARIABLES' }, { label: 'Numerator' }],
		rows,
		div: tableDiv,
		maxWidth: '40vw',
		maxHeight: '40vh',
		noButtonCallback: syncNumerators,
		striped: false,
		showHeader: true,
		selectAll: true,
		columnButtons: undefined,
		buttons: undefined
	})
	tableDiv.select('thead').select('[data-testid="sjpp-table-checkall"]').node()?.parentElement?.append(' Denominator')
	for (const [i, { numerator }] of getRowInputs(tableDiv).entries()) {
		numerator?.addEventListener('change', () => {
			if (numerator.checked) numeratorIds.add(termlst[i].id)
			else numeratorIds.delete(termlst[i].id)
		})
	}

	holder
		.append('div')
		.append('button')
		.attr('data-testid', 'sjpp-term-collection-fraction-select')
		.text(opts.buttonLabel || 'Select')
		.on('click', () => {
			const inputs = getRowInputs(tableDiv)
			const denominators = termlst.filter((_, i) => inputs[i]?.denominator?.checked === true).map(term => term.id)
			const numerators = termlst.filter((_, i) => inputs[i]?.numerator?.checked === true).map(term => term.id)
			if (!denominators.length) return window.alert('Select at least one denominator.')
			if (!numerators.length) return window.alert('Select at least one numerator.')
			if (numerators.some(id => !denominators.includes(id)))
				return window.alert('Every numerator must also be selected as a denominator.')
			callback({ numerators, denominators })
		})
}

export function makeFractionTermWrapper(
	term: any,
	selection: { numerators: string[]; denominators: string[] }
): RawTermCollectionTWFraction {
	return {
		type: 'TermCollectionTWFraction' as const,
		term,
		q: {
			mode: 'continuous',
			numerators: selection.numerators,
			denominators: selection.denominators
		}
	}
}
