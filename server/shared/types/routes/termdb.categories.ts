import { Filter } from '../filter.ts'
import { TermWrapper } from '#shared/types/terms/tw.ts'

export type getcategoriesRequest = {
	genome: string
	dslabel: string
	embedder: string
	/** termwrapper object */
	tw: TermWrapper
	/** optional q object to apply termsetting and passed to getData() to customize fetched categories.
	use case e.g. logistic regression outcome variable is always binary */
	term1_q?: { isAtomic: boolean; hiddenValues: object; type: string; groupsetting: { disabled: boolean }; mode: string }
	filter?: Filter
	/** quick fix only for gdc */
	currentGeneNames?: string[]
	/** optional property added by mds3 tk, to limit to cases mutated in this region */
	rglst?: any
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
