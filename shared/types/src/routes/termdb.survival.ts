import type { Filter } from '../filter.ts'

export type TermdbSurvivalRequest = {
	genome: string
	dslabel: string
	embedder?: string

	// term wrapper fields follow the termdb term0/term1/term2 naming convention
	term0?: any
	term0_q?: any
	term0_id?: string
	term0_$id?: string
	term0_type?: string

	term1?: any
	term1_q?: any
	term1_id?: string
	term1_$id?: string
	term1_type?: string

	term2?: any
	term2_q?: any
	term2_id?: string
	term2_$id?: string
	term2_type?: string

	filter?: Filter
	filter0?: any
	hiddenValues?: {
		term1?: string[]
		term2?: string[]
	}
}

export type SurvivalCaseRow = [
	chartId: string,
	seriesId: string,
	time: number,
	survival: number,
	lower: number,
	upper: number,
	nevent: number,
	ncensor: number,
	nrisk: number
]

export type SurvivalTest = {
	series1: string
	series2: string
	pvalue: string
}

export type TermdbSurvivalResponse =
	| {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk']
			case: SurvivalCaseRow[]
			refs: {
				bins?: any[]
				byTermId?: any
				orderedKeys?: {
					chart: string[]
					series: string[]
				}
			}
			tests?: {
				[chartId: string]: SurvivalTest[]
			}
	  }
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
