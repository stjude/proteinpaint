import type { Filter } from '../filter.ts'
import type { SampleFilterGroup } from '../terms/samplelst.ts'

/** Call DMRs across many regions in one request — a whole differential-methylation hit list
 * rather than one clicked element. See server/src/routes/termdb.dmrBatch.ts for why this is a
 * route and not a client loop. */
export type TermdbDmrBatchRequest = {
	genome: string
	dslabel: string
	/** each group as the list of its samples, or defined by a filter that the server resolves;
	 * sample ids are resolved server-side to matrix names */
	group1: { sampleId: number | string }[] | SampleFilterGroup
	group2: { sampleId: number | string }[] | SampleFilterGroup
	filter0?: any
	/** Windows to report DMRs in, from a run over the chromosomes they are on. Overlapping windows
	 * are merged first. Ignored when scanChromosomes is given. */
	regions?: { chr: string; start: number; stop: number }[]
	/** Scan these chromosomes end to end instead of supplying windows — an unbiased DMR scan
	 * rather than a drill-down of a hit list.
	 *
	 * Either way the request is one DMRcate run over every CpG of the chromosomes it names (see
	 * rust/src/dmrcate.rs), so a scan costs little more than drilling windows on the same
	 * chromosomes. Measured 2026-10-28: DISCOVER chr17 (1.1M CpGs) in ~3s and its whole genome
	 * (26.6M CpGs, 214,978 DMRs) in ~65s; MMRF's genome (16.4M CpGs) in ~50s.
	 *
	 * One chromosome is comfortably interactive; a whole genome is a background job. The
	 * per-region size cap does not apply to these, by construction. */
	scanChromosomes?: string[]
	/** Ask for the genome-wide binned methylation profile alongside the DMRs. Only a scan wants it:
	 * a drill-down of a few windows would be describing regions the caller did not ask about. */
	binMethylation?: boolean
	/** DMRCate lambda: Gaussian kernel bandwidth in nucleotides (default 1000). Also the distance
	 * within which significant probes are chained into one DMR, so it partly determines the widths
	 * reported — record it alongside any width distribution. */
	lambda?: number
	/** DMRCate C: scaling factor for kernel width (default 2) */
	C?: number
	/** FDR cutoff for per-probe significance (default 0.05) */
	fdr_cutoff?: number
	/** Which element matrix to use on a dataset with no CpG matrix. Ignored where a CpG matrix
	 * exists, which is always finer. */
	element_type?: string
	/** Artifact-region exclude mask applied to the called DMRs: a DMR whose span lies >= overlapFrac
	 * inside the selected blacklist regions is dropped. Sources are declared per genome
	 * (Genome.blacklists) and selected here by name, the same way GRIN2 selects them.
	 *
	 * Omitted = the methylation default (ENCODE blacklist + segmental duplications), which is NOT
	 * all declared sources: see DM_DEFAULT_BLACKLISTS in server/src/utils/regionMask.ts for why DGV
	 * common germline CNVs and assembly gaps are excluded from a methylation mask. An empty
	 * blacklists array disables masking. */
	excludeOptions?: {
		/** names matching Genome.blacklists[].name; omitted = methylation default, [] = no masking */
		blacklists?: string[]
		/** drop a DMR when >= this fraction of its span is masked (default 0.5) */
		overlapFrac?: number
	}
	/** Score each called DMR against matched intergenic background, answering "did this region move
	 * more than a region like it would have drifted anyway?" rather than "did it move at all". On a
	 * cohort with a large global shift the second question is answered yes almost everywhere.
	 * Costs a second rust invocation per chromosome. */
	backgroundCorrection?: boolean
	filter?: Filter
	__protected__?: any
}

export type TermdbDmrBatchSuccessResponse = {
	status: 'ok'
	/** The genome and dataset the result was computed for. A cached scan is later read back by
	 * cacheId alone (termdb/dmrGeneLink), which must check these against the dataset the caller is
	 * authorized for. Absent on results cached before they were recorded. */
	genome?: string
	dslabel?: string
	/** The cacheScope the result was computed with (sampleFilterScope() in the server), which
	 * termdb/dmrGeneLink compares with the scope of its own request. Empty for a dataset without
	 * a sample filter, and absent on results cached before it was recorded. */
	scope?: string
	regions: {
		chr: string
		/** the merged window actually analysed, which may be wider than any single input region */
		start: number
		stop: number
		/** indices into the request's `regions` that merged into this window */
		members: number[]
		/** probes with usable data in the window */
		n_probes: number
		/** of those, how many passed the per-probe FDR cutoff */
		n_sig_probes: number
		dmrs: {
			chr: string
			start: number
			stop: number
			no_cpgs: number
			/** DMRcate's region-wise statistics (dmrcate() in the Bioconductor package): the least
			 * kernel-smoothed FDR in the region, then the Stouffer, harmonic-mean and Fisher combinations
			 * of its raw per-CpG p-values, each BH-adjusted across every region the run built */
			min_smoothed_fdr: number
			Stouffer: number | null
			HMFDR: number | null
			Fisher: number | null
			/** DMRcate's largest and mean per-CpG difference, in its own units: the limma logFC of the
			 * log2 methylated/unmethylated read ratio for WGBS (logit2), of the M-value for an element matrix */
			maxdiff: number
			meandiff: number
			/** The same two on the beta scale -- case minus control group mean beta, over the CpGs of the
			 * region. Not DMRcate's: carried for display, as the effect a reader interprets. */
			delta_beta_max: number | null
			delta_beta_mean: number | null
			/** the sign of delta_beta_mean, which every figure plots; meandiff's when no cell is covered.
			 * Not meandiff's otherwise: its pseudocount log-ratio follows read depth where groups differ in it */
			direction: 'hyper' | 'hypo'
			/** Genes whose span overlaps the DMR, in genomic order. Absent when none overlap or the
			 * genome has no gene2coord table. Capped -- see genesTruncated. */
			/** Observed delta-beta minus the mean drift of matched background in the same stratum.
			 * Present only when backgroundCorrection was requested and the DMR's stratum had enough
			 * background to estimate from. */
			excess?: number
			/** Fraction of that background drifting at least this far in the same direction, with a
			 * +1 pseudocount -- so the resolution floor is 1/(n+1) and never zero. */
			bgP?: number
			/** The region overlaps the body of at least one gene -- its span with 2kb trimmed from both
			 * ends. Separate from `genes` because promoter and gene-body methylation relate to
			 * transcription in opposite directions. */
			inGeneBody?: boolean
			/** Every gene whose body (span less 2kb at each end) the DMR overlaps, uncapped. The set a
			 * gene-body analysis should use: `genes` also holds promoter-only neighbours and is capped. */
			bodyGenes?: string[]
			genes?: string[]
			/** Total overlapping genes when more than the cap were found, so a truncated list is
			 * never mistaken for the whole set. */
			genesTruncated?: number
		}[]
		/** DMRs the artifact mask dropped from dmrs, each with the mask sources that cover it. Not
		 * counted or plotted by the scan; the region view draws them as masked. */
		masked?: (TermdbDmrBatchSuccessResponse['regions'][number]['dmrs'][number] & { maskedBy: string[] })[]
		/** true when this chromosome fell back to the element matrix, so one "probe" is a
		 * regulatory element rather than a CpG and the widths are not base-resolution */
		elementResolution: boolean
	}[]
	/** Cohort-wide methylation level of each group and the difference between them, measured over
	 * every value the model fits read — NOT over the requested regions, so it is an unbiased
	 * backdrop rather than a restatement of the result.
	 *
	 * Read every region result against this: where the whole genome shifts, part of each region's
	 * difference is this number rather than anything local to the region. Absent when no
	 * chromosome reported one. */
	globalMethylation?: {
		controlMeanBeta: number
		caseMeanBeta: number
		/** case - control, on the beta scale */
		shift: number
		valuesCounted: number
		/** mean reads per CpG of each group, over every cell of the CpGs the model read; absent for an
		 * element matrix. Where they differ, DMRcate's pseudocount log-ratio differs with no change in
		 * methylation, so DMRs with little beta change may be depth rather than biology. */
		controlMeanDepth?: number
		caseMeanDepth?: number
	}
	/** chromosomes in the run */
	chromosomes: number
	/** What a region view needs to recompute any region of this run exactly as the run saw it
	 * (termdb/dmr, rust/src/dmrcate.rs): the eBayes prior, the raw-p cuts that BH and the adaptive
	 * cutoff amount to, and the parameters the run used, which a region view must match. Absent on
	 * results cached before runs were genome-wide. */
	constants?: DmrRunConstants
	totalProbesAnalyzed: number
	/** Matched-background outcome. Present whenever the correction ran. `unscored` is the count
	 * whose stratum held too little background to estimate from -- reported so a survival rate is
	 * never read against the wrong denominator. */
	backgroundCorrection?: {
		windows: number
		scored: number
		unscored: number
		significant: number
		/** The covariates actually matched on. The full method also matches solo-WCGW, replication
		 * timing and lamina association, which need normal-B-cell reference tracks; where those are
		 * absent the correction is weaker and must be described by what it did match. */
		matchedOn: string[]
	}
	/** Artifact-region mask outcome. Present whenever the mask ran, including when it dropped
	 * nothing, so a reader can tell "no artifacts here" from "the mask never ran". The dropped DMRs
	 * are gone from `regions[].dmrs` — this is the count needed to report the denominator. */
	regionMask?: {
		/** blacklist source names actually applied */
		sources: string[]
		overlapFrac: number
		/** DMRs removed because >= overlapFrac of their span was masked */
		dmrsDropped: number
	}
	resources?: DmrRunResources
	/** Mean methylation per group in fixed-width bins along the genome, present when the request
	 * asked for it. This is the metric methylome papers plot for a genome-wide comparison; unlike
	 * the DMR list it covers every bin with probes, so an unchanged stretch is visible as measured
	 * and unchanged rather than as absence. Computed from the group means the fit already holds. */
	binMethylation?: {
		binBp: number
		bins: { chr: string; start: number; n_probes: number; control: number; case: number }[]
	}
}

export type DmrRunConstants = {
	s20: number | null
	/** null is an infinite prior df */
	df0: number | null
	df_cap: number
	/** largest raw p among individually significant CpGs; null when there were none */
	ind_p_cut: number | null
	/** largest smoothed raw p, and the smoothed FDR, that the adaptive cutoff kept; null when nothing was */
	smoothed_raw_cut: number | null
	smoothed_fdr_cut: number | null
	/** individually significant CpGs, the number the adaptive cutoff matches */
	nsig: number
	lambda: number
	C: number
	fdr_cutoff: number
}

/** What one run of the route cost, measured while it ran. Stored with the cached result, so a
 * cached answer reports the cost of the run that produced it, not of serving it. Read this to size
 * a deployment: memory is per worker and scales with the chromosome, CPU is one core per worker. */
export type DmrRunResources = {
	/** dmrcate processes run at once: one, which reads every chromosome of the run */
	workers: number
	/** threads that process uses, reading matrix files concurrently */
	threadsPerWorker: number
	wallMs: number
	/** largest resident set any one worker reached, MB */
	peakWorkerMemoryMb: number
	/** sum of the `workers` largest worker peaks: the most the pool can have held at once, MB */
	peakPoolMemoryMb: number
	/** user + system CPU seconds over every worker */
	workerCpuSeconds: number
	/** the Node process: resident growth over the run and CPU it spent itself, mask reads and
	 * background sampling included */
	nodeRssDeltaMb: number
	nodeCpuSeconds: number
	/** one row per worker invocation, largest first */
	perChromosome: { chr: string; probes: number; peakMemoryMb: number; cpuSeconds: number; elapsedMs: number }[]
}

export type TermdbDmrBatchErrorResponse = { error: string }

export type TermdbDmrBatchResponse = TermdbDmrBatchSuccessResponse | TermdbDmrBatchErrorResponse
