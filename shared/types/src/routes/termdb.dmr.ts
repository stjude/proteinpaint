import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.ts'

export type TermdbDmrRequest = {
	genome: string
	dslabel: string
	/** list of samples from each group */
	group1: Sample[]
	group2: Sample[]
	/** query region */
	chr: string
	start: number
	stop: number
	/** DMRCate lambda parameter: Gaussian kernel bandwidth in nucleotides (default 1000) */
	lambda?: number
	/** DMRCate C parameter: scaling factor for kernel width (default 2) */
	C?: number
	/** FDR cutoff for CpG significance (default 0.05) */
	fdr_cutoff?: number
	/** display name for group1 (e.g. from volcano plot) */
	group1Name?: string
	/** display name for group2 (e.g. from volcano plot) */
	group2Name?: string
	/** Backend engine: 'rust' (genome-wide eBayes, default) or 'r' (DMRCate via cached limma) */
	backend?: 'rust' | 'r'
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	sample: string
}

export type DmrDiagnostic = {
	probes: {
		positions: number[]
		mean_group1: number[]
		mean_group2: number[]
		fdr: number[]
		logFC: number[]
	}
	probe_spacings: number[]
	/** Total probes analyzed genome-wide for eBayes */
	total_probes_analyzed?: number
	/** Peak RSS memory in MB */
	peak_memory_mb?: number
	/** Starting RSS memory in MB */
	start_memory_mb?: number
	/** Total elapsed time in milliseconds */
	elapsed_ms?: number
}

export type TermdbDmrSuccessResponse = {
	status: 'ok'
	dmrs: {
		chr: string
		start: number
		stop: number
		/** Number of CpG sites in this DMR */
		no_cpgs: number
		/** Minimum FDR from the kernel-smoothed estimate across the region */
		min_smoothed_fdr: number
		/** Harmonic mean of individual CpG FDR-corrected p-values */
		HMFDR: number
		/** Maximum methylation difference (beta-scale) within the DMR */
		maxdiff: number
		/** Mean methylation difference across the DMR */
		meandiff: number
		/** hyper = case hypermethylated relative to control; hypo = opposite */
		direction: 'hyper' | 'hypo'
		/** Comma-separated gene symbols overlapping the DMR */
		overlapping_genes?: string
	}[]
	/** Diagnostic data: per-CpG probe means and statistics */
	diagnostic?: DmrDiagnostic
}

export type TermdbDmrErrorResponse = {
	error: string
}

export type TermdbDmrResponse = TermdbDmrSuccessResponse | TermdbDmrErrorResponse

export const TermdbDmrPayload: RoutePayload = {
	request: {
		typeId: 'TermdbDmrRequest'
	},
	response: {
		typeId: 'TermdbDmrResponse'
	}
}
