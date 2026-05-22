import type { ErrorResponse } from './errorResponse.ts'

export type SingleCellSample = {
	/** Sample name, required */
	sample: string
	/** optional list of sc data files available for this sample, gdc-specific
	if available:
		each row of sample table will infact be one experiment.
		selecting one will use its experimentID as "sample" value in request parameter
		each experiment may have additional fields that may be displayed in table. see singleCell.samples.experimentColumns[]

	if no exp, then each sample will just have one experiment identifiable by its sample name, and this name is used in request
	*/
	[key: string]: any //sample column/term value
	experiments?: {
		sampleName: any
		experimentID?: string
	}[]
	isMetaResult?: boolean // whether this sample is a meta result. if so, sample name is from plot.sampleId or plot.name and experimentID is not used
	// a sample may have additional fields that will be displayed in table, see singleCell.samples.sampleColumns[]
}

export type TermdbSingleCellSamplesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	filter?: any // for termdb
	filter0?: any //Filter0 // for gdc
}
type ValidResponse = {
	/** List of sample names with singlecell data */
	samples: SingleCellSample[]
	metaResults?: {
		/** identifier of one result */
		name: string
	}[]
}

export type TermdbSingleCellSamplesResponse = ErrorResponse | ValidResponse

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
