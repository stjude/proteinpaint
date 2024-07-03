import { ErrorResponse } from './errorResponse.ts'

export type TermdbSinglecellDEgenesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample name */
	sample: string
	/** column name to provide cell groups/clustering, for which DE genes are precomputed.
	 */
	columnName: string
	/** User selected cell group/cluster, corresponds to columnName, for which DE genes will be returned to client */
	categoryName: string
}

export type HasdataResponse = {
	/** List of plots from singlecell experiment of this sample */
	genes: {
		/** gene name */
		name: string
		/** p-value */
		pvalue: number
		/** log foldchange */
		logfoldchange: number
	}[]
}

export type TermdbSinglecellDEgenesResponse = ErrorResponse | HasdataResponse
