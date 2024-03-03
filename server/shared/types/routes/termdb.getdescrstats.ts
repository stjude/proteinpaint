import { Filter } from '../filter.ts'

export type getdescrstatsRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	tid: string
	filter: Filter
}

interface entries {
	id: string
	label: string
	value: number
}

export type getdescrstatsResponse = {
	values: entries[]
}
