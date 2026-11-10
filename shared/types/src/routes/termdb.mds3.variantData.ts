import type { ErrorResponse } from './errorResponse.ts'

export type TermdbMds3VariantDataRequest = {
	genome: string
	dslabel: string
	chr: string
	start: number
	stop: number
	details: {
		groups: Record<string, unknown>[]
		[key: string]: unknown
	}
	filter?: Record<string, unknown>
	filter0?: Record<string, unknown>
	variantFilter?: unknown
	sampleTypes?: number[]
}

export type ValidMds3VariantReponse = {
	mlst: Record<string, unknown>[]
	/** number of samples in the type=filter group, when the group is group 1 */
	totalSampleCount_group1?: number
	/** number of samples in the type=filter group, when the group is group 2 */
	totalSampleCount_group2?: number
	/** average ancestry proportion per population set, when a population group adjusts for race */
	pop2average?: Record<string, number>
}

export type TermdbMds3VariantDataResponse = ErrorResponse | ValidMds3VariantReponse
