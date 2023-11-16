export type TermdbSinglecellsamplesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	//filter0?: Filter0 // for gdc
}

export type TermdbSinglecellsamplesResponse = {
	/** List of sample names with singlecell data */
	samples: string[]
}
