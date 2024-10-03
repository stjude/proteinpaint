import { ErrorResponse } from './errorResponse.ts'
import { Filter } from '../filter.ts'
import { Term } from '../terms/term.ts'
import { GeneExpressionTerm } from '../terms/geneExpression.ts'
import { MetaboliteIntensityTerm } from '../terms/metaboliteIntensity.ts'

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

export type GeneExpressionInput = {
	/** Query to get gene expression fpkm data */
	data_type: 'expression_count'
	/** Name of HDF5 file */
	hdf5_file: string
	/** List of genes to be queried */
	genes: string
	/** List of samples to be queried, if undefined all samples will be queried in the dataset */
	limitSamples?: string
}

export type TermdbClusterRequestGeneExpression = TermdbClusterRequestBase & {
	/** Data type */
	dataType: 'geneExpression'
	/** List of terms */
	terms: GeneExpressionTerm[]
	/** Storage type HDF5 or bed. bed format will be deprecated later */
	storage_type: 'HDF5' | 'bed'
}

export type TermdbClusterRequestMetabolite = TermdbClusterRequestBase & {
	/** Data type */
	dataType: 'metaboliteIntensity'
	/** List of terms */
	terms: MetaboliteIntensityTerm[]
}

export type TermdbClusterRequest = TermdbClusterRequestGeneExpression | TermdbClusterRequestMetabolite

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
