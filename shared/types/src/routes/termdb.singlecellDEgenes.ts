import type { ErrorResponse } from './errorResponse.ts'

export type TermdbSinglecellDEgenesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample name
	for GDC the value is "seurat.analysis.tsv" file UUID rather than sample name. the file contains the analysis results for an experiment
	*/
	sample: string
	/** column name to provide cell groups/clustering, for which DE genes are precomputed.  */
	columnName: string
	/** User selected cell group/cluster, corresponds to columnName, for which DE genes will be returned to client */
	categoryName: string
}

export type HasDataResponse = {
	/** list of significant DE genes for the given category in the sample */
	genes: {
		/** gene name */
		name: string
		/** adjusted p-value */
		p_val_adj: number
		/** log foldchange */
		avg_log2FC: number
	}[]
}

export type TermdbSinglecellDEgenesResponse = ErrorResponse | HasDataResponse
