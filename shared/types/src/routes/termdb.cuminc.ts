import type { Filter } from '../filter.ts'

export type TermdbCumincRequest = {
	genome: string
	dslabel: string
	embedder?: string

	term0?: any
	term0_q?: any
	term0_id?: string
	term0_$id?: string

	term1?: any
	term1_q?: any
	term1_id?: string
	term1_$id?: string

	term2?: any
	term2_q?: any
	term2_id?: string
	term2_$id?: string

	filter?: Filter
	filter0?: any
	minSampleSize: number | string
}

export type TermdbCumincResponse =
	| {
			data: {
				[chartId: string]: any
			}
			refs?: {
				bins?: any[]
			}
			noEvents?: {
				[chartId: string]: string[]
			}
			lowSampleSize?: {
				[chartId: string]: string[]
			}
	  }
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
