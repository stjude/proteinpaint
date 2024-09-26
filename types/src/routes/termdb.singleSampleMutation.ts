import { ErrorResponse } from './errorResponse.ts'

export type TermdbSingleSampleMutationRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** sample id */
	sample: string
}
type ValidResponse = {
	/** List of mutation data points from this sample TODO change to type of M elements */
	mlst: object[]
	/** */
	dt2total?: { dt: number; total: number }[]
}

export type TermdbSingleSampleMutationResponse = ErrorResponse | ValidResponse
