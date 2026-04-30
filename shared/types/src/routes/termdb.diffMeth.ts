import type { RoutePayload } from './routeApi.js'
import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

export type DiffMethRequest = {
	/** Genome build name */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Object containing two arrays of samples for differential methylation analysis */
	samplelst: any
	/** Minimum non-NA samples required per group (default 3) */
	min_samples_per_group?: number
	/** Term for confounding variable 1 (if present) */
	tw?: any
	/** Term for confounding variable 2 (if present) */
	tw2?: any
	/** Option to return early with actual number of samples with methylation values */
	preAnalysis?: boolean
	/** Parameters for the server-side `da` Rust renderer. Always required — the
	 * server always returns a rendered PNG plus the threshold-passing rows. */
	volcanoRender: VolcanoRenderRequest
}

/** Response when DiffMethRequest.preAnalysis === true. Returns per-group
 * sample counts (keyed by group name) plus an optional validation alert. */
export type DiffMethPreAnalysisResponse = {
	data: Record<string, number | string>
}

/** Response for a full differential methylation run (preAnalysis absent/false). */
export type DiffMethFullResponse = {
	/** The volcano payload — per-promoter interactive dots + PNG + extents +
	 * totals. See VolcanoData for details. */
	data: VolcanoData<DiffMethEntry>
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
}

export type DiffMethResponse = DiffMethPreAnalysisResponse | DiffMethFullResponse

export type DiffMethEntry = DataEntry & {
	/** ENCODE CRE promoter ID (e.g. EH38E3756858) */
	promoter_id: string
	/** Gene symbol(s) associated with the promoter (comma-separated if multiple) */
	gene_name: string
	/** Chromosome (e.g. "chr1") */
	chr: string
	/** Promoter start coordinate (0-based) */
	start: number
	/** Promoter end coordinate (exclusive) */
	stop: number
}

export const diffMethPayload: RoutePayload = {
	request: {
		typeId: 'DiffMethRequest'
	},
	response: {
		typeId: 'DiffMethResponse'
	}
}
