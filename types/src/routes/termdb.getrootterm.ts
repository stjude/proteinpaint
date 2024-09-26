export type getroottermRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	default_rootterm: number
	cohortValues: string
	treeFilter: string
}

interface entries {
	name: string
	id: string
	isleaf: boolean
	included_types: string[]
	child_types: string[]
}

export type getroottermResponse = {
	lst: entries[]
}
