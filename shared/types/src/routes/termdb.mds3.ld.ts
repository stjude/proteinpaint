import type { ErrorResponse } from './errorResponse.ts'

export type TermdbMds3LDRequest = {
	genome: string
	dslabel: string
	ldtkname: string
	m: {
		chr: string
		pos: number
		ref: string
		alt: string
	}
}

export type TermdbMds3LDResponse =
	| ErrorResponse
	| {
			lst: { pos: number; alleles: string; r2: number }[]
			nodata?: boolean
	  }
