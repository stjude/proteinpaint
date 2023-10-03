import { Filter } from '../filter'

export type getgetCategoriesRequest = {
	genome: string
	dslabel: string
	embedder: string
	getcategories: number
	tid: string
	filter: Filter
}

interface entries {
	samplecount: number
	key: string
	label: string
}

export type getgetCategoriesResponse = {
	lst: entries[]
	orderedLabels?: []
}
