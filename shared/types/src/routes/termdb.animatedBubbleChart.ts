import type { ErrorResponse } from './errorResponse.ts'

export type AnimatedBubbleChartRequest = {
	genome: string
	dslabel: string
	/** Which ranking file to load (key from `queries.geneRanking.rankings`). Default: first key. */
	rankingKey?: string
}

export type AssaySlice = {
	assay: string
	/** Raw individual rank for this assay (or null if NA in TSV) */
	rank: number | null
	/** Normalized log-weight log(N/rank)/log(N) (N = max rank for the assay across the
	 *  file), i.e. this modality's share of the gene's ring. 0..1, null if NA. */
	weight: number | null
	/** Slice angle in radians, normalized so all slices for the gene sum to 2π. 0 if NA. */
	angle: number
}

export type AnimatedBubble = {
	gene: string
	integrativeRank: number
	orderStatQ: number | null
	pValue: number | null
	fdr: number | null
	slices: AssaySlice[]
}

export type AnimatedBubbleChartResponse =
	| ErrorResponse
	| {
			bubbles: AnimatedBubble[]
			/** Modalities (assay names) in dataset-configured order */
			assays: string[]
			/** All ranking keys available, for the client dropdown */
			rankingKeys: string[]
			/** The ranking key the server actually loaded (resolved from default if request omitted it) */
			selectedRankingKey: string
	  }
