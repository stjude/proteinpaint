import type { ErrorResponse } from './errorResponse.ts'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

export type DapVolcanoRequest = {
	genome: string
	dslabel: string
	organism: string
	assay: string
	cohort: string
	volcanoRender?: VolcanoRenderRequest
	countsOnly?: boolean
	/** return one {gene, log2FC, fdr} row per gene (most significant accession) instead of a rendered volcano */
	rowsOnly?: boolean
}

export type DapEntry = DataEntry & {
	gene_name: string
	gene: string
}

export type DapVolcanoResponse =
	| ErrorResponse
	| {
			sample_size1: number
			sample_size2: number
			data?: VolcanoData<DapEntry>
			/** rowsOnly mode */
			rows?: { gene: string; log2FC: number; fdr: number }[]
	  }
