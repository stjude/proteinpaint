import type { RoutePayload } from './routeApi.js'
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

	// a sample may have additional fields that will be displayed in table, see singleCell.samples.sampleColumns[]
}

export type TermdbSingleCellSamplesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	//filter0?: Filter0 // for gdc
}
type ValidResponse = {
	/** List of sample names with singlecell data */
	samples: SingleCellSample[]
	fields: string[]
	columnNames: string[]
	sameLegend?: boolean
}

export type TermdbSingleCellSamplesResponse = ErrorResponse | ValidResponse

export const termdbSingleCellSamplesPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSingleCellSamplesRequest'
	},
	response: {
		typeId: 'TermdbSingleCellSamplesResponse'
	}
	// examples: []
}
