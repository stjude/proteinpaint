export type gettermbyidRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	embedder: string
	/** term id string */
	gettermbyid: string
}

export type gettermbyidResponse = {
	term: {
		name: string
		type: string
		values: {
			ABC: {
				label: string
			}
			XYZ: {
				label: string
			}
		}
		id: string
		isleaf: boolean
		groupsetting: {
			disabled: boolean
		}
	}
}
