import { Filter } from '../filter.ts'
import { Term } from '#shared/types/term.ts'

export type getcategoriesRequest = {
	genome: string
	dslabel: string
	embedder: string
	getcategories: number
	term: Term // term object; this route only accepts term obj but not termwrapper
	filter: Filter // should be optional
	type: string // not used?
	/** optional q object to apply termsetting and passed to getData() to customize fetched categories.
	use case e.g. logistic regression outcome variable is always binary */
	term1_q?: { isAtomic: boolean; hiddenValues: object; type: string; groupsetting: { disabled: boolean }; mode: string }
}

interface entries {
	samplecount: number
	key: string
	label: string
}

export type getcategoriesResponse = {
	lst: entries[]
	orderedLabels?: []
}
