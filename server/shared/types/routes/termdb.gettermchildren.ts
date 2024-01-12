export type gettermchildrenRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	get_children: number
	tid: string
}

interface entries {
	name: string
	id: string
	isleaf: boolean
	included_types: string[]
	child_types: string[]
}

export type gettermchildrenResponse = {
	lst: entries[]
}
