import { ErrorResponse } from './errorResponse.js'
import { Filter } from '../filter.js'
import { Term } from '../terms/term.js'
import { GeneVariantTerm } from '../terms/geneVariant.js'

export type Gene = {
	/** gene symbol, required */
	gene: string
	/** optionally, client may supply chr/start/stop; if missing, backend code may add them when processing native dataset */
	chr?: string
	start?: number
	stop?: number
}

export type TermdbClusterRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** cluster method */
	clusterMethod: string
	/** distance method */
	distanceMethod: string
	/** Data type */
	dataType: string
	/** List of genes TODO can be non-genes when dataType is generalized */
	terms: /*Term[] |*/ GeneVariantTerm[]
	/** pp filter */
	filter?: Filter
	/** todo gdc filter */
	filter0?: any
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
}

//response of just 1 gene, thus unable to do clustering
export type SingletermResponse = {
	term: Term
	data: any
}

export type TermdbClusterResponse = ErrorResponse | ValidResponse | SingletermResponse
