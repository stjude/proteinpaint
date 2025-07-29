import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'

export type TermdbSingleSampleMutationRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** sample id, allow string or number; for native ds, sample name in number will be cast into string */
	sample: string | number
}
type ValidResponse = {
	/** List of mutation data points from this sample TODO change to type of M elements */
	mlst: object[]
	/** total number of items for each dt, useful to indicate snvindel limited to 10k for a hypermutator */
	dt2total?: { dt: number; total: number }[]
	/** alternative data by dt
	key: dt value
	value: array of objects, each is a distinct set of data points for this dt
		on ui, selecting an object will allow to show this data in disco plot
		each is identified by either nameHtml or name
	*/
	alternativeDataByDt: {
		[index: number]: {
			/** hyperlink */
			nameHtml?: string
			/** name in text */
			name?: string
			/** required list of events from this data */
			mlst: object[]
		}[]
	}
}

export type TermdbSingleSampleMutationResponse = ErrorResponse | ValidResponse

export const termdbSingleSampleMutationPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSingleSampleMutationRequest'
	},
	response: {
		typeId: 'TermdbSingleSampleMutationResponse'
	}
	// examples: []
}
