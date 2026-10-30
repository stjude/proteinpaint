import type { Filter } from '../filter.ts'
import type { SampleFilterGroup } from '../terms/samplelst.ts'
import type { TermdbDmrBatchSuccessResponse } from './termdb.dmrBatch.ts'
import type { DmrScanYAxis } from './termdb.diffMeth.ts'

export type TermdbDmrRequest = {
	genome: string
	dslabel: string
	/** each group as the list of its samples, or defined by a filter that the server resolves */
	group1: Sample[] | SampleFilterGroup
	group2: Sample[] | SampleFilterGroup
	filter0?: any
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
	/** The chromosomes of the DMRcate run this view is a window on: a region opened from a scan names
	 * the scan's, so it shows the DMRs the volcano drew. Absent = the whole genome; a list without chr is
	 * refused, since that region was not in the run. */
	scanChromosomes?: string[]
	/** That scan's background correction, which is in its run's cache key, so the view finds the run */
	backgroundCorrection?: boolean
	/** That scan's CpG floor: DMRs from fewer CpGs are left out, as the scan leaves them out. Absent = 1 */
	minCpgs?: number
	/** That scan's y-axis statistic: DMRs without it are left out, as the scan leaves them out. Absent =
	 * min_smoothed_fdr; ignored with backgroundCorrection, whose background p is the one then */
	yAxis?: DmrScanYAxis
	filter?: Filter
	__protected__?: any
}

type Sample = {
	sampleId: number | string
	/** Ignored by the server, which resolves sampleId against the termdb: a caller cannot be
	 * relied on to carry names, and the name must be the one the methylation matrix is keyed by. */
	sample?: string
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
		/** individually significant in the run: per-CpG BH-adjusted p < fdr_cutoff */
		sig: boolean[]
		/** kept by the run's adaptive cutoff on the kernel-smoothed FDR, which is what DMRs are built from */
		smoothed_sig: boolean[]
		/** DMRcate's per-CpG diff: the limma logFC, logit2 for WGBS */
		logFC: (number | null)[]
	}
	probe_spacings: number[]
	/** LOESS smoothed curves with 95% CI for both groups */
	loess?: DmrLoessCurves
	/** Total probes in the run the region is a window on */
	total_probes_analyzed?: number
	/** Peak RSS memory in MB */
	peak_memory_mb?: number
	/** Starting RSS memory in MB */
	start_memory_mb?: number
	/** Total elapsed time in milliseconds */
	elapsed_ms?: number
	/** Server-rendered track PNG as data URI */
	track_png?: string | null
}

export type TermdbDmrSuccessResponse = {
	status: 'ok'
	/** the run's DMRs that overlap the region */
	dmrs: TermdbDmrBatchSuccessResponse['regions'][number]['dmrs']
	/** the run's DMRs in the region that the artifact mask dropped, with the sources that cover them */
	maskedDmrs?: NonNullable<TermdbDmrBatchSuccessResponse['regions'][number]['masked']>
	/** Diagnostic data: per-CpG probe means and statistics */
	diagnostic?: DmrDiagnostic
}

export type TermdbDmrErrorResponse = {
	error: string
}

export type TermdbDmrResponse = TermdbDmrSuccessResponse | TermdbDmrErrorResponse

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
