import { TermTypes } from '#types'
import { numericTypes } from '#shared'

/* returns defaultQ for term0/term2 aimed for charts including summary, survival, cuminc
 keyed by term type, except that float/integer/date terms are all keyed by 'numeric'

 nqAsBinary toggles numeric q for both dictionary and non-dict terms
 	- true, use "binary" custom bin set by median
 	- false, use default regular bins
 */
export function getT0T2defaultQ(nqAsBinary: boolean = false): { [termType: string]: any } {
	const nb = nqAsBinary ? { mode: 'discrete', type: 'custom-bin', preferredBins: 'median' } : { mode: 'discrete' }
	const re = {
		[TermTypes.GENE_VARIANT]: { type: 'predefined-groupset' },

		// covers float & integer dictionary numeric term. allow to use their default bins
		numeric: structuredClone(nb),

		// this is supposed to be TermCollectionTWFraction
		[TermTypes.TERM_COLLECTION]: {
			mode: 'discrete',
			type: 'custom-bin',
			lst: getDefaultFractionBins(),
			denominators: [],
			numerators: []
		}
	}

	// add all the rest of numerical molecular types. fix them
	for (const t of numericTypes) {
		if (t == 'integer' || t == 'float' || t == 'date') continue // excluded. keyed by 'numeric' above
		re[t] = structuredClone(nb)
	}
	return re
}

export function getDefaultFractionBins() {
	return [
		{ startunbounded: true, stop: 0.25, label: '<25%' },
		{ start: 0.25, stop: 0.5, startinclusive: true, label: '25% to <50%' },
		{ start: 0.5, stop: 0.75, startinclusive: true, label: '50% to <75%' },
		{ start: 0.75, stopunbounded: true, startinclusive: true, label: '≥75%' }
	]
}
