import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'

export type TermdbSingleCellDEgenesRequest = {
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
	data: {
		/** gene name */
		gene_name: string
		/** adjusted p-value */
		adjusted_p_value: number
		/** original p-value */
		original_p_value: number
		/** log2 fold change */
		fold_change: number
	} /*TODO: May replace with DataEntry from termdb.DE.ts in the future*/[]
}

export type TermdbSingleCellDEgenesResponse = ErrorResponse | HasDataResponse

export const termdbSingleCellDEgenesPayload: RoutePayload = {
	request: {
		typeId: 'TermdbSingleCellDEgenesRequest'
	},
	response: {
		typeId: 'TermdbSingleCellDEgenesResponse'
	}
	// examples: []
}
