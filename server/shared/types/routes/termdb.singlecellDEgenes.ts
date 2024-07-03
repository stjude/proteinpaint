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
		/** adjusted p-value */
		p_val_adj: number
		/** log foldchange */
		avg_log2FC: number
	}[]
}

export type TermdbSinglecellDEgenesResponse = ErrorResponse | HasdataResponse
