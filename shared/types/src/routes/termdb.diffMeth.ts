import type { RoutePayload } from './routeApi.js'
import type { DataEntry } from './termdb.DE.js'

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
}

export type DiffMethResponse = {
	/** Array of promoter-level differential methylation results */
	data: DiffMethEntry[]
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
}

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
