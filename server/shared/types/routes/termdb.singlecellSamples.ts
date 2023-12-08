export type Sample = {
	/** Sample name, required */
	sample: string
	/** optional list of sc data files available for this sample, gdc-specific */
	files?: any
}

export type TermdbSinglecellsamplesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	//filter0?: Filter0 // for gdc
}

export type TermdbSinglecellsamplesResponse = {
	/** List of sample names with singlecell data */
	samples: Sample[]
	fields: String[]
	columnNames: String[]
}
