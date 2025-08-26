import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'
import type { Filter } from '../filter.ts'
import type { Term } from '../terms/term.ts'
import type { GeneExpressionTW } from '../terms/geneExpression.ts'
import type { MetaboliteIntensityTerm } from '../terms/metaboliteIntensity.ts'
import type { NumericDictTerm } from '../terms/numeric.ts'

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

export type TermdbClusterRequestGeneExpression = TermdbClusterRequestBase & {
	/** Data type */
	dataType: 'geneExpression'
	/** List of terms */
	terms: GeneExpressionTW[]
	/** perform z-score transformation on values */
	zScoreTransformation?: string
}

export type TermdbClusterRequestMetabolite = TermdbClusterRequestBase & {
	/** Data type */
	dataType: 'metaboliteIntensity'
	/** List of terms */
	terms: MetaboliteIntensityTerm[]
	/** perform z-score transformation on values */
	zScoreTransformation?: string
}

export type TermdbClusterRequestNumericDictTerm = TermdbClusterRequestBase & {
	/** Data type */
	dataType: 'numericDictTerm'
	/** List of terms */
	terms: NumericDictTerm[]
	/** perform z-score transformation on values */
	zScoreTransformation?: string
}

export type TermdbClusterRequest =
	| TermdbClusterRequestGeneExpression
	| TermdbClusterRequestMetabolite
	| TermdbClusterRequestNumericDictTerm

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

export const termdbClusterPayload: RoutePayload = {
	request: {
		typeId: 'TermdbClusterRequest'
	},
	response: {
		typeId: 'TermdbClusterResponse'
	}
	//examples: []
}
