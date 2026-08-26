import type { ErrorResponse } from './errorResponse.ts'

export type BrainRegionsRequest = {
	genome: string
	dslabel: string
	gene: string
}

export type BrainRegionsEntry = {
	/** log2 fold change, case vs control, from the cohort's DAP file */
	fold_change: number
	/** nominal p-value (DAP file column 6); falls back to the FDR when the file has no p column */
	p_value: number
	/** BH-adjusted p-value (DAP file column 5) */
	fdr: number
}

export type BrainRegionsIsoform = {
	gene_name: string
	data: {
		[disease: string]: {
			[region: string]: BrainRegionsEntry
		}
	}
}

export type BrainRegionsResponse =
	| ErrorResponse
	| {
			isoforms: { [isoformId: string]: BrainRegionsIsoform }
			regions: { [code: string]: string }
			diseases: string[]
			templateUrl: string
			svgUrl: string
	  }
