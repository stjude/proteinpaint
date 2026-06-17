import type { ErrorResponse } from './errorResponse.ts'

export type BubbleHeatmapRequest = {
	genome: string
	dslabel: string
	gene: string
}

/** One modification site (PTM) or one protein-level measurement (whole/insoluble
 *  proteome). PTM cells carry many of these; protein-level cells carry exactly one. */
export type BubbleSite = {
	/** site identifier — the DAPfile `identifier` column (modified peptide for PTM,
	 *  e.g. `K.VAVVRT%PPKSPSS*AK.S`; protein id for protein-level rows) */
	id: string
	/** raw per-site log2 fold change from the DAPfile */
	log2FC: number
	/** raw per-site p-value from the DAPfile */
	p_value: number
	/** true when p_value < the response's pValueThreshold; non-significant sites
	 *  are still returned (the client draws non-significant protein-level dots faded
	 *  and hides non-significant PTM sites) */
	significant: boolean
	/** matched reference-assay (total protein) log2FC for this protein (base UniProt
	 *  acc) + cohort, if available */
	proteinLog2FC?: number
	/** protein-abundance-adjusted change = log2FC − proteinLog2FC (point estimate),
	 *  present only when proteinLog2FC is available */
	adjustedLog2FC?: number
	/** true when a matched protein value existed and adjustedLog2FC was computed */
	adjustedAvailable: boolean
}

export type BubbleCell = {
	/** all sites for this (acc, assay, cohort); one entry for protein-level assays */
	sites: BubbleSite[]
}

export type BubbleHeatmapIsoform = {
	gene_name: string
	/** data[assay][cohort] → cell (omitted when the cohort doesn't exist under the
	 *  assay or the gene has no row in that DAPfile) */
	data: {
		[assay: string]: {
			[cohort: string]: BubbleCell
		}
	}
}

export type BubbleHeatmapResponse =
	| ErrorResponse
	| {
			isoforms: { [isoformId: string]: BubbleHeatmapIsoform }
			/** subset of `assays` that are PTM assays — rendered as multiple small
			 *  per-site dots; the rest render as a single big dot per cell */
			ptmAssays: string[]
			/** Row order */
			assays: string[]
			/** Column order */
			cohorts: string[]
			/** raw p-value threshold below which a site is significant. Sites with
			 *  p ≥ threshold are still returned with `significant: false`; the client
			 *  draws non-significant protein-level dots faded and omits non-significant
			 *  PTM sites. */
			pValueThreshold: number
			/** assay used as the total-protein baseline for protein-abundance
			 *  adjustment, or null when adjustment is not configured for this dataset */
			proteinReferenceAssay: string | null
	  }

export const bubbleHeatmapPayload = {
	request: { typeId: 'BubbleHeatmapRequest' },
	response: { typeId: 'BubbleHeatmapResponse' }
}
