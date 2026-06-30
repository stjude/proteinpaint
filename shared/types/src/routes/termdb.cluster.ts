import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'
import type { Term } from '../terms/term.ts'
import type { BaseTW } from '../terms/tw.ts'
import type { NumericBaseTerm } from '../terms/numeric.ts'
import type { GeneExpressionTW } from '../terms/geneExpression.ts'
import type { IsoformExpressionTW } from '../terms/isoformExpression.ts'
import type { ProteomeDetails } from '../terms/proteomeAbundance.ts'

export type Gene = {
	/** gene symbol, required */
	gene: string
	/** optionally, client may supply chr/start/stop; if missing, backend code may add them when processing native dataset */
	chr?: string
	start?: number
	stop?: number
}

type TermdbClusterRequestBase = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** cluster method */
	clusterMethod: string
	/** distance method */
	distanceMethod: string
	/** pp filter */
	filter?: Filter
	/** todo gdc filter */
	filter0?: any
}

// These two named request types are retained only as the param type of the dataset-supplied
// getters (validateNative / validateNativeIsoform); they are not part of the request union.
export type TermdbClusterRequestGeneExpression = TermdbClusterRequestBase & {
	dataType: 'geneExpression'
	terms: GeneExpressionTW[]
	zScoreTransformation?: string
}

export type TermdbClusterRequestIsoformExpression = TermdbClusterRequestBase & {
	dataType: 'isoformExpression'
	terms: IsoformExpressionTW[]
	zScoreTransformation?: string
}

/** Clustering is agnostic to the numeric data type: one request carries a homogeneous list
 *  of numeric term wrappers plus the shared `dataType`. */
export type TermdbClusterRequest = TermdbClusterRequestBase & {
	/** numeric data type shared by all clustered terms (e.g. geneExpression, metaboliteIntensity,
	 *  isoformExpression, ssgsea, proteomeAbundance, or a numeric dictionary-term type ) */
	dataType: string
	/** list of numeric term wrappers to cluster; `term` is constrained to NumericBaseTerm
	 *  (the shared supertype of every numeric term) so any numeric term qualifies without
	 *  enumerating each TW type, while non-numeric terms are excluded */
	terms: (BaseTW & { term: NumericBaseTerm; q?: any })[]
	/** perform z-score transformation on values before clustering */
	zScoreTransformation?: string
	/** organism/assay/cohort context; required only for proteomeAbundance */
	proteomeDetails?: ProteomeDetails
}

export type Hclust = {
	merge: { n1: number; n2: number }[]
	height: { height: number }[]
	order: { name: string }[]
	inputOrder: string[]
}
export type Clustering = {
	row: Hclust
	col: Hclust
	matrix: number[][]
}

// response with clustering result of multiple gene/rows
export type ValidResponse = {
	/**  */
	clustering: Clustering
	/**  */
	byTermId: { [index: string]: any }
	/**  */
	bySampleId: { [index: string]: any }
	/** list of term names that are excluded from analysis, one reason per set, for client display */
	removedHierClusterTerms?: {
		/** reason for skipping */
		text: string
		/** list of skipped item names */
		lst: string[]
	}[]
}

//response of just 1 gene, thus unable to do clustering
export type SingletermResponse = {
	term: Term
	data: any
}

export type TermdbClusterResponse = ErrorResponse | ValidResponse | SingletermResponse

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
