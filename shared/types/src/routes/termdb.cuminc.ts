import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Term } from '../terms/term.ts'

export type TermdbCumincRequest = {
	genome: string
	dslabel: string
	embedder?: string

	/* term wrappers follow the termdb term0/term1/term2 naming convention: term0 divides the
	samples into charts, term1 is the condition term supplying the time and event, and term2
	stratifies the samples into series.

	A wrapper is posted whole. The term<i>_* fields below are the superseded form, in which a
	wrapper is dissected into a term id or bare term plus its q, $id and wrapper type; they
	are still served, but a wrapper type does not survive that round trip, so do not use
	them. */
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
	minSampleSize: number | string
}

export type CumincResponse = {
	data: {
		[chartId: string]: any
	}
	refs?: {
		bins?: any[]
	}
	noEvents?: {
		[chartId: string]: string[]
	}
	lowSampleSize?: {
		[chartId: string]: string[]
	}
}

export type TermdbCumincResponse =
	| CumincResponse
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
