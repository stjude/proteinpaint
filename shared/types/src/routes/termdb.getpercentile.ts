import type { Filter } from '../filter.ts'

export type getpercentileRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	getpercentile: number[]
	/** term id string */
	tid: string
	filter: Filter
}

export type getpercentileResponse = {
	values: number[]
}
