import type { Filter } from '../filter.ts'

/** Call DMRs across many regions in one request — a whole differential-methylation hit list
 * rather than one clicked element. See server/src/routes/termdb.dmrBatch.ts for why this is a
 * route and not a client loop. */
export type TermdbDmrBatchRequest = {
	genome: string
	dslabel: string
	/** list of samples from each group; sample ids are resolved server-side to matrix names */
	group1: { sampleId: number | string }[]
	group2: { sampleId: number | string }[]
	/** Windows to call DMRs in. Overlapping windows are merged before analysis.
	 * Ignored when scanChromosomes is given. */
	regions?: { chr: string; start: number; stop: number }[]
	/** Scan these chromosomes end to end instead of supplying windows — an unbiased DMR scan
	 * rather than a drill-down of a hit list.
	 *
	 * Affordable because the model fit is already chromosome-wide and the kernel smoothing is a
	 * sliding window (linear in CpGs, not quadratic), so scanning a whole chromosome costs barely
	 * more than drilling a few windows on it. Measured on MMRF: chr20 (362k CpGs) in ~3s, all 23
	 * chromosomes (16.4M CpGs) in ~131s, yielding 149,341 DMRs.
	 *
	 * One chromosome is comfortably interactive; a whole genome is a background job. The
	 * per-region size cap does not apply to these, by construction. */
	scanChromosomes?: string[]
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
	filter?: Filter
	__protected__?: any
}

export type TermdbDmrBatchSuccessResponse = {
	status: 'ok'
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
			min_smoothed_fdr: number
			HMFDR: number
			maxdiff: number
			meandiff: number
			direction: 'hyper' | 'hypo'
		}[]
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
	}
	/** chromosomes touched — the number of model fits performed, which is what the cost scales with */
	chromosomes: number
	totalProbesAnalyzed: number
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
}

export type TermdbDmrBatchErrorResponse = { error: string }

export type TermdbDmrBatchResponse = TermdbDmrBatchSuccessResponse | TermdbDmrBatchErrorResponse
