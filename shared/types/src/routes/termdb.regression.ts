import type { Filter } from '../filter.ts'
import type { TermWrapper } from '../terms/tw.ts'

type RegressionCell = string | number | boolean | null
type RegressionRow = RegressionCell[]

export type RegressionHeaderRow = {
	k: string
	v: unknown
}

export type RegressionLabeledTable = {
	header: string[]
	rows: RegressionRow[]
	label: string
}

export type RegressionCoefficientTerm = {
	fields?: RegressionRow[number][]
	categories?: Record<string, RegressionRow[number][]>
}

export type RegressionCoefficientInteraction = {
	term1: string
	term2: string
	categories: Array<{
		category1: string
		category2: string
		lst: RegressionRow[number][]
	}>
}

export type RegressionCoefficients = {
	header: string[]
	intercept?: RegressionRow[number][]
	terms: Record<string, RegressionCoefficientTerm>
	interactions: RegressionCoefficientInteraction[]
	label: string
}

export type RegressionType3 = {
	header: string[]
	intercept?: RegressionRow[number][]
	terms: Record<string, RegressionRow[number][]>
	interactions: Array<{
		term1: string
		term2: string
		lst: RegressionRow[number][]
	}>
	label: string
}

// nonlinearity statistics, only present when the model has cubic spline variables
// same shape as the type III table, minus the intercept and interaction rows
export type RegressionNonlinearity = {
	header: string[]
	terms: Record<string, RegressionRow[number][]>
	label: string
}

export type RegressionTotalSnpEffect = {
	header: string[]
	snp: string
	interactions: Array<{
		term1: string
		term2: string
	}>
	lst: RegressionRow[number][]
	label: string
}

export type RegressionSplinePlot = {
	src: string
	size: string
	type?: 'univariate' | 'multivariate'
}

export type RegressionFisher = {
	isChi: boolean
	pvalue: number
	rows: Array<Array<string | number>>
}

export type RegressionWilcoxon = {
	pvalue: string | number
	boxplots: {
		minv: number | null
		maxv: number | null
		hasEff: unknown
		noEff: unknown
	}
}

export type RegressionCuminc =
	| {
			pvalue: 'NA'
			msg: string
	  }
	| {
			pvalue: number
			ci_data: Record<string, unknown>
	  }

export type TermdbRegressionRequest = {
	genome: string
	dslabel: string
	filter0?: any
	filter?: Filter
	includeUnivariate?: boolean
	regressionType: 'linear' | 'logistic' | 'cox'
	/** a minimum tw copy, see vocabApi.getTwMinCopy(); term type is read from tw.term.type */
	outcome: TermWrapper & {
		refGrp?: string
		nonRefGrp?: string
	}
	/** minimum tw copies, same as the outcome above */
	independent: Array<
		TermWrapper & {
			refGrp?: string
			interactions?: string[]
		}
	>
}

export type TermdbRegressionResultEntry = {
	id?: string
	AFstr?: string
	data: {
		sampleSize?: number
		eventCnt?: number
		headerRow?: RegressionHeaderRow
		residuals?: RegressionLabeledTable
		coefficients?: RegressionCoefficients
		coefficients_uni?: RegressionCoefficients
		coefficients_multi?: RegressionCoefficients
		type3?: RegressionType3
		nonlinearity?: RegressionNonlinearity
		totalSnpEffect?: RegressionTotalSnpEffect
		tests?: RegressionLabeledTable
		other?: RegressionLabeledTable
		splinePlots?: RegressionSplinePlot[]
		warnings?: string[]
		fisher?: RegressionFisher
		wilcoxon?: RegressionWilcoxon
		cuminc?: RegressionCuminc
	}
}

export type RegressionResponse = {
	resultLst: TermdbRegressionResultEntry[]
}

export type TermdbRegressionResponse =
	| RegressionResponse
	| {
			error: string
	  }
