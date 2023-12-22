import { ErrorResponse } from './errorResponse'
import { Filter } from '../filter'

export type Gene = {
	gene: string
}

export type TermdbClusterRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** List of genes TODO generalize as termwrappers with numeric data on samples */
	genes: Gene[]
	/** pp filter */
	filter?: Filter
	filter0?: any
}

export type Children = {
	/**  */
	id: number
	/**  */
	children: number[]
}

export type Dendro = {
	id1: number
	id2: number
	x1: number
	x2: number
	y1: number
	y2: number
}

export type Clustering = {
	/**  */
	col_children: Children[]
	/**  */
	row_children: Children[]
	/**  */
	col_dendro: Dendro[]
	/**  */
	row_dendro: Dendro[]
	/**  */
	geneNameLst: string[]
	/**  */
	sampleNameLst: string[]
	/**  */
	matrix: number[][]
	/** to be deleted */
	col_names_index: number[]
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
export type SinglegeneResponse = {
	gene: string
	data: any
}

export type TermdbClusterResponse = ErrorResponse | ValidResponse | SinglegeneResponse
