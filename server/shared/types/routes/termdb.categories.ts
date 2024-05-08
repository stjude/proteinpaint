import { Filter } from '../filter.ts'
import { Term } from '#shared/types/termdb.ts'

export type getcategoriesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	getcategories: number
	/** term id string */
	term: Term
	filter: Filter
	type: string
	term1_q: { isAtomic: boolean; hiddenValues: object; type: string; groupsetting: { disabled: boolean }; mode: string }
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
