import type { RoutePayload } from './routeApi.js'
import type { ErrorResponse } from './errorResponse.ts'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

export type TermdbSingleCellDEgenesRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample identifier 
	 * for GDC the value is "seurat.analysis.tsv" file UUID
	rather than sample name, derived from the eID. The file 
	contains the analysis results for an experiment */
	sample: { sID: string; eID: string }
	/** column name to provide cell groups/clustering,
	 * for which DE genes are precomputed.  */
	termId: string
	/** User selected cell group/cluster, corresponds to termId,
	 * for which DE genes will be returned to client */
	categoryName: string
	/** Parameters for the server-side `volcano` Rust renderer. Always required — the
	 * server always returns a rendered PNG plus the threshold-passing rows. */
	volcanoRender: VolcanoRenderRequest
}

export type SingleCellDEEntry = DataEntry & {
	/** gene name */
	gene_name: string
}

export type HasDataResponse = {
	/** The volcano payload — per-gene interactive dots + PNG + extents + totals.
	 * See VolcanoData for details. */
	data: VolcanoData<SingleCellDEEntry>
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
