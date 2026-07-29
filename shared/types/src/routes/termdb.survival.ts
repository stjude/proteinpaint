import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Term } from '../terms/term.ts'

export type TermdbSurvivalRequest = {
	genome: string
	dslabel: string
	embedder?: string

	/* term wrappers follow the termdb term0/term1/term2 naming convention: term0 divides
	the samples into charts, term1 or term2 is the survival term and the other stratifies
	the samples into series.

	A wrapper is posted whole. The term<i>_* fields below are the superseded form, in which
	a wrapper is dissected into a term id or bare term plus its q, $id and wrapper type;
	they are still served, but a wrapper type other than TermCollectionTWFraction does not
	survive that round trip, so do not use them. */
	term0?: TermWrapper | Term
	term1?: TermWrapper | Term
	term2?: TermWrapper | Term

	/** @deprecated post the term wrapper in term0 */
	term0_q?: any
	/** @deprecated post the term wrapper in term0 */
	term0_id?: string
	/** @deprecated post the term wrapper in term0 */
	term0_$id?: string
	/** @deprecated post the term wrapper in term0 */
	term0_type?: string

	/** @deprecated post the term wrapper in term1 */
	term1_q?: any
	/** @deprecated post the term wrapper in term1 */
	term1_id?: string
	/** @deprecated post the term wrapper in term1 */
	term1_$id?: string
	/** @deprecated post the term wrapper in term1 */
	term1_type?: string

	/** @deprecated post the term wrapper in term2 */
	term2_q?: any
	/** @deprecated post the term wrapper in term2 */
	term2_id?: string
	/** @deprecated post the term wrapper in term2 */
	term2_$id?: string
	/** @deprecated post the term wrapper in term2 */
	term2_type?: string

	filter?: Filter
	filter0?: any
	hiddenValues?: {
		term1?: string[]
		term2?: string[]
	}
}

export type SurvivalCaseRow = [
	chartId: string,
	seriesId: string,
	time: number,
	survival: number,
	lower: number,
	upper: number,
	nevent: number,
	ncensor: number,
	nrisk: number
]

export type SurvivalTest = {
	series1: string
	series2: string
	pvalue: string
}

export type TermdbSurvivalResponse =
	| {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk']
			case: SurvivalCaseRow[]
			refs: {
				bins?: any[]
				byTermId?: any
				orderedKeys?: {
					chart: string[]
					series: string[]
				}
			}
			tests?: {
				[chartId: string]: SurvivalTest[]
			}
	  }
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
