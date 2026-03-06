import type { RoutePayload } from './routeApi.js'

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

export type DiffMethInput = {
	/** Case samples separated by , */
	case: string
	/** Control samples separated by , */
	control: string
	/** Absolute path to promoter-level M-value HDF5 file */
	input_file: string
	/** Minimum non-NA samples required per group */
	min_samples_per_group?: number
	/** Confounding variable 1 values, one per sample */
	conf1?: any[]
	/** Type of the confounding variable 1 (continuous/discrete) */
	conf1_mode?: 'continuous' | 'discrete'
	/** Confounding variable 2 values, one per sample */
	conf2?: any[]
	/** Type of the confounding variable 2 (continuous/discrete) */
	conf2_mode?: 'continuous' | 'discrete'
}

export type DiffMethResponse = {
	/** Array of promoter-level differential methylation results */
	data: DiffMethDataEntry[]
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
}

export type DiffMethDataEntry = {
	/** ENCODE CRE promoter ID (e.g. EH38E3756858) */
	promoter_id: string
	/** Gene symbol(s) associated with the promoter (comma-separated if multiple) */
	gene_name: string
	/** M-value difference (positive = hypermethylated in cases) */
	fold_change: number
	/** Raw p-value from moderated t-test */
	original_p_value: number
	/** FDR-adjusted p-value (Benjamini-Hochberg) */
	adjusted_p_value: number
}

export const diffMethPayload: RoutePayload = {
	request: {
		typeId: 'DiffMethRequest'
	},
	response: {
		typeId: 'DiffMethResponse'
	}
}
