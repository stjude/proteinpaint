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
	/** concordance mode: join this cohort's DAP with another's on upper-cased gene and
	 *  return the log2FC points plus their Pearson correlation (R cor.test) instead of a volcano */
	concordanceWith?: { organism: string; assay: string; cohort: string }
}

export type DapEntry = DataEntry & {
	gene_name: string
	gene: string
}

export type DapConcordance = {
	points: { gene: string; x: number; y: number }[]
	/** null when R reports NA or n < 3 */
	r: number | null
	p: number | null
	n: number
}

export type DapVolcanoResponse =
	| ErrorResponse
	| {
			sample_size1: number
			sample_size2: number
			data?: VolcanoData<DapEntry>
			/** concordanceWith mode */
			concordance?: DapConcordance
	  }
