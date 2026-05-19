export type BrainImagingSamplesRequest = {
	/** a user-defined genome label in the serverconfig.json, hg38, hg19, mm10, etc */
	genome: string
	/** a user-defined dataset label in the serverconfig.json, such as ClinVar, SJLife, GDC, etc */
	dslabel: string
	/** a user-defined brain template label in dataset file, such as Ref1, Ref2 */
	refKey: string
}

export type BrainImagingSamplesResponse = {
	samples: BrainSample[]
}

export type BrainSample = { [key: string]: string }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
