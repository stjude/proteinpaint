import { Filter } from '../filter'
import { TermWrapper } from '../terms/tw'

export type getcategoriesRequest = {
	genome: string
	dslabel: string
	embedder: string
	/** termwrapper object */
	tw: TermWrapper
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
