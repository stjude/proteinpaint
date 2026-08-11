import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'
import type { Term } from '../terms/term.ts'

type JsonObject = Record<string, unknown>

export type TermdbCumincRequest = {
	genome: string
	dslabel: string
	embedder?: string

	term0?: TermWrapper | Term
	term1?: TermWrapper | Term
	term2?: TermWrapper | Term

	filter?: Filter
	filter0?: JsonObject
	minSampleSize: number | string
}

export type CumincEstimatePoint = {
	time: number
	est: number
	var: number
	low: number
	up: number
	nrisk: number
	nevent: number
	ncensor: number
}

export type CumincSeriesMap = {
	[seriesId: string]: CumincEstimatePoint[]
}

export type CumincGrayTest = {
	series1: string
	series2: string
	pvalue: number | string
	permutation: boolean
}

export type CumincChart = {
	estimates?: CumincSeriesMap
	tests?: CumincGrayTest[]
	chartId?: string
	[key: string]: unknown
}

export type CumincRefs = {
	bins?: unknown[]
	byTermId?: unknown
	orderedKeys?: {
		chart?: string[]
		series?: string[]
	}
	[key: string]: unknown
}

export type CumincResponse = {
	data: {
		[chartId: string]: CumincChart
	}
	refs?: CumincRefs
	noEvents?: {
		[chartId: string]: string[]
	}
	lowSampleSize?: {
		[chartId: string]: string[]
	}
}

export type TermdbCumincResponse =
	| CumincResponse
	| {
			error: string
	  }

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
