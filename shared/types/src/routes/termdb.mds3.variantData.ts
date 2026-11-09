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
}

export type ValidMds3VariantReponse = {
	mlst: Record<string, unknown>[]
	skipMcountWithoutAlt: number
	[key: string]: unknown
}

export type TermdbMds3VariantDataResponse = ErrorResponse | ValidMds3VariantReponse
