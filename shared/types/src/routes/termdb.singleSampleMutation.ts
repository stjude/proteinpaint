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
	/** */
	dt2total?: { dt: number; total: number }[]
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
