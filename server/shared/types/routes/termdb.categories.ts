import { Filter } from '../filter'

export type getcategoriesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	getcategories: number
	/** term id string */
	tid: string
	filter: Filter
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
