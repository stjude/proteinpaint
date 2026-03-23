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
	/** Block width in CSS pixels for server-side track rendering (default 800) */
	blockWidth?: number
	/** Device pixel ratio for server-side track rendering (default 1) */
	devicePixelRatio?: number
	/** Maximum region size (bp) to show LOESS curves (default 50000) */
	maxLoessRegion?: number
	/** Group/DMR colors for server-side track rendering */
	colors?: { group1: string; group2: string; hyper: string; hypo: string }
	/** Backend engine: 'rust' (genome-wide eBayes, default) or 'r' (DMRCate via cached limma) */
	backend?: 'rust' | 'r'
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	sample: string
}

export type DmrLoessCurves = {
	/** Evenly spaced genomic positions where LOESS was evaluated */
	positions: number[]
	/** LOESS fitted values for group 1 (control) */
	group1_fitted: number[]
	/** Lower 95% CI bound for group 1 */
	group1_ci_lower: number[]
	/** Upper 95% CI bound for group 1 */
	group1_ci_upper: number[]
	/** LOESS fitted values for group 2 (case) */
	group2_fitted: number[]
	/** Lower 95% CI bound for group 2 */
	group2_ci_lower: number[]
	/** Upper 95% CI bound for group 2 */
	group2_ci_upper: number[]
}

export type DmrDiagnostic = {
	probes: {
		positions: number[]
		mean_group1: (number | null)[]
		mean_group2: (number | null)[]
		fdr: number[]
		logFC: (number | null)[]
	}
	probe_spacings: number[]
	/** LOESS smoothed curves with 95% CI for both groups */
	loess?: DmrLoessCurves
	/** Total probes analyzed genome-wide for eBayes */
	total_probes_analyzed?: number
	/** Peak RSS memory in MB */
	peak_memory_mb?: number
	/** Starting RSS memory in MB */
	start_memory_mb?: number
	/** Total elapsed time in milliseconds */
	elapsed_ms?: number
	/** Server-rendered track PNG as data URI (Rust backend only) */
	track_png?: string
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
