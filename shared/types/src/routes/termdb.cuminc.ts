import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Term } from '../terms/term.ts'

type JsonObject = Record<string, unknown>

type DeprecatedTermFields = {
	q?: unknown
	id?: string
	$id?: string
	type?: string
}

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
	term0_q?: DeprecatedTermFields['q']
	/** @deprecated post the term wrapper in term0 */
	term0_id?: DeprecatedTermFields['id']
	/** @deprecated post the term wrapper in term0 */
	term0_$id?: DeprecatedTermFields['$id']
	/** @deprecated post the term wrapper in term0 */
	term0_type?: DeprecatedTermFields['type']

	/** @deprecated post the term wrapper in term1 */
	term1_q?: DeprecatedTermFields['q']
	/** @deprecated post the term wrapper in term1 */
	term1_id?: DeprecatedTermFields['id']
	/** @deprecated post the term wrapper in term1 */
	term1_$id?: DeprecatedTermFields['$id']
	/** @deprecated post the term wrapper in term1 */
	term1_type?: DeprecatedTermFields['type']

	/** @deprecated post the term wrapper in term2 */
	term2_q?: DeprecatedTermFields['q']
	/** @deprecated post the term wrapper in term2 */
	term2_id?: DeprecatedTermFields['id']
	/** @deprecated post the term wrapper in term2 */
	term2_$id?: DeprecatedTermFields['$id']
	/** @deprecated post the term wrapper in term2 */
	term2_type?: DeprecatedTermFields['type']

	filter?: Filter
	filter0?: JsonObject
	minSampleSize: number | string
}

export type CumincEstimatePoint = {
	time: number
	est: number
	var: number
	low: number
	up: number
	nrisk: number
	nevent: number
	ncensor: number
}

export type CumincSeriesMap = {
	[seriesId: string]: CumincEstimatePoint[]
}

export type CumincGrayTest = {
	series1: string
	series2: string
	pvalue: number | string
	permutation: boolean
}

export type CumincChart = {
	estimates?: CumincSeriesMap
	tests?: CumincGrayTest[]
	chartId?: string
	[key: string]: unknown
}

export type CumincRefs = {
	bins?: unknown[]
	byTermId?: unknown
	orderedKeys?: {
		chart?: string[]
		series?: string[]
	}
	[key: string]: unknown
}

export type CumincResponse = {
	data: {
		[chartId: string]: CumincChart
	}
	refs?: CumincRefs
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
