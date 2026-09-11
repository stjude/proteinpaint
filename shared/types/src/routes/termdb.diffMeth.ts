import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'
import type { DmrRunResources } from './termdb.dmrBatch.js'

/** The element_type that asks the differential-methylation volcano to call DMRs de novo across
 * the genome (termdb/dmrBatch scan mode) instead of testing a pre-annotated element class. Not a
 * key into ds.queries.dnaMethylation.elements; termdb.config.ts lists it among elementTypes when
 * the dataset has a matrix the region analysis can run on. */
export const DMR_SCAN_ELEMENT_TYPE = 'dmr_scan'

export type DiffMethRequest = {
	/** Discriminator tag. Matches the `kind` field on `DmCacheResult` and
	 * lets the GSEA route tell a snapshot DM request apart from a snapshot
	 * DE request without structural-shape probing. */
	kind: 'DM'
	/** Genome build name */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Object containing two arrays of samples for differential methylation analysis */
	samplelst: any
	/** Minimum non-NA samples required per group (default 3) */
	min_samples_per_group?: number
	/** Drop chrX/chrY elements before testing (default false). X-inactivation makes
	 * chrX methylation strongly sex-dependent, so a sex-imbalanced comparison produces
	 * chrX hits that are sex rather than the grouping variable. */
	exclude_sex_chr?: boolean
	/** Which regulatory-element class to test, keying into
	 * ds.queries.dnaMethylation.elements. Absent means 'promoter', which keeps every
	 * existing client request and cache entry valid. The available keys and their
	 * display labels come from the dataset config, so the picker is data-driven rather
	 * than a hardcoded list. */
	element_type?: string
	/** Only read when element_type is DMR_SCAN_ELEMENT_TYPE. Every field has a default, so a bare
	 * scan request scans the whole genome uncorrected and keeps DMRs of 5+ CpGs. */
	scan?: {
		/** one chromosome to scan; absent = every major chromosome except the mitochondrion */
		chromosome?: string
		/** score each DMR against matched intergenic background (termdb/dmrBatch
		 * backgroundCorrection); the volcano's p then becomes that empirical p and DMRs whose
		 * stratum held too little background are left out of the rows */
		backgroundCorrection?: boolean
		/** drop DMRs called from fewer CpGs than this before rendering */
		minCpgs?: number
	}
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
	/** number of samples with methylation data, keyed by group name. a group name is
	 * user-supplied, so it must not share this object with any other property */
	data: Record<string, number>
	/** validation message; the client hides the run button while it is present */
	alert?: string
}

/** Response for a full differential methylation run (preAnalysis absent/false). */
export type DiffMethFullResponse = {
	/** The volcano payload — per-element interactive dots + PNG + extents +
	 * totals. See VolcanoData for details. */
	data: VolcanoData<DiffMethEntry>
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
	/** Present only for a DMR scan: what the scan did and found, beyond the rows themselves. */
	scan?: DmrScanSummary
}

/** Whole-scan facts the volcano's Statistics panel and genome map are drawn from. Every count here
 * is over the scan as returned by termdb/dmrBatch, before the volcano's own thresholds, so the
 * panel can state what the rows were selected from. */
export type DmrScanSummary = {
	/** chromosomes scanned, in genome order */
	chromosomes: string[]
	totalProbesAnalyzed: number
	/** DMRs the scan called, before any filtering here */
	called: number
	/** the minCpgs that was applied, and how many DMRs met it */
	minCpgs: number
	kept: number
	/** direction split of the kept DMRs */
	hyper: number
	hypo: number
	/** width quantiles (bp) of the kept DMRs; absent when none were kept */
	width?: { median: number; q1: number; q3: number }
	globalMethylation?: { controlMeanBeta: number; caseMeanBeta: number; shift: number; valuesCounted: number }
	regionMask?: { sources: string[]; overlapFrac: number; dmrsDropped: number }
	/** present when the correction ran. `scored` and `significant` count the kept DMRs; `unscored`
	 * kept DMRs had no background in their stratum and are not among the rows */
	backgroundCorrection?: { windows: number; scored: number; unscored: number; significant: number; matchedOn: string[] }
	/** genes under kept hypomethylated gene-body DMRs that beat background (p<0.05) -- the set the
	 * expression test (termdb/dmrGeneDE) runs on. Present only with the correction. */
	geneBodyLoss?: { regions: number; genes: string[] }
	/** The two groups cut to the samples with methylation data, as sample ids: the cohort any
	 * expression step after a scan should run on, so both readings come from the same patients. */
	matchedSamplelst?: { groups: { name: string; values: { sampleId: number | string }[]; [k: string]: any }[] }
	/** what the scan cost when it was computed; see DmrRunResources */
	resources?: DmrRunResources
	/** the cached scan the rows came from, so its DMRs can be fetched back for a browser track
	 * (termdb/dmrScanTrack) without recomputing anything */
	cacheId?: string
	/** Every kept DMR drawn along the genome, hyper above the line and hypo below, y = signed
	 * -log10 of the q the volcano plots; the N most significant per direction carry pixel
	 * coordinates and are interactive. Rendered per request, after the cache, because it depends
	 * on the client's pixel ratio. */
	manhattan?: { png: string; plotData: any; interactive: number; plotWidth: number; plotHeight: number }
}

export type DiffMethResponse = DiffMethPreAnalysisResponse | DiffMethFullResponse

/** One tested regulatory element. Despite the field names, this is NOT promoter-specific:
 * the same shape describes promoters, cCRE classes, eQTM blocks and promoter sub-window tiles.
 * `promoter_id` keeps its name only for backward compatibility with existing clients — read
 * `element_class` to know what a row actually is. */
export type DiffMethEntry = DataEntry & {
	/** Row key, unique within a result. For an untiled run this equals `element_id`; for a
	 * tiled run it is the composite "<element_id>::tile<N>", so rows stay unique while
	 * `element_id` remains groupable. Named `promoter_id` for backward compatibility from when
	 * the analysis was promoter-only. */
	promoter_id: string
	/** The bare element identifier, without any tile suffix — e.g. an ENCODE cCRE accession
	 * (EH38E3756858) for cCRE builds, or the builder's own id for eQTM blocks. Resolved from
	 * meta/element/elementID, meta/element_id, or legacy meta/promoter/promoterID. */
	element_id: string
	/** Which class this row belongs to: 'promoter', 'enhancer_distal', 'eqtm_block', etc.
	 * Present per row because one matrix may hold several classes, in which case the run-level
	 * label is 'mixed' while each row still names its own. */
	element_class: string
	/** Sub-window index within the element, 5'->3'. Only present when the input was a tile
	 * matrix (build_element_matrix.py --tiles N); absent otherwise, so a non-tiled run's shape
	 * is unchanged. */
	tile_index?: number
	/** Gene symbol(s) associated with the element (comma-separated if multiple, may be empty) */
	gene_name: string
	/** Chromosome (e.g. "chr1") */
	chr: string
	/** Element start coordinate (0-based). For a tile row this is the tile's own span, not the
	 * parent element's. */
	start: number
	/** Element end coordinate (exclusive) */
	stop: number
	/** Group 1 (control) mean beta, over observed cells only. Absent on a DMR-scan row, which
	 * carries the difference but not the two means. */
	mean_beta_control?: number
	/** Group 2 (case) mean beta, over observed cells only */
	mean_beta_case?: number
	/** mean_beta_case - mean_beta_control. The interpretable effect size: fold_change is a
	 * difference of M-values (a logit), so it does not say how much methylation changed.
	 * Same sign as fold_change, since both are case - control. Derived by back-transforming
	 * the stored M-values, which yields the alpha-smoothed beta and so shrinks the difference
	 * toward zero by 2/(depth+2) — under 1% at this cohort's typical promoter depth. */
	delta_beta: number
	/** DMR-scan rows only (element_class 'dmr'): CpGs the region was called from, and when the
	 * background correction ran, the observed delta-beta minus the matched drift. */
	no_cpgs?: number
	excess?: number
}

/** What diffMeth.R actually tested, as opposed to what was asked for. Emitted by the R script
 * alongside the rows; NOT currently forwarded to the client by termdb.diffMeth.ts, which passes
 * only `promoter_data` through. Documented here because the R output is a shared contract and a
 * caller reading it directly (or a future route that does forward it) needs the shape.
 *
 * It exists because promoter, enhancer and tile runs all use identical column names, so without
 * it a result is indistinguishable from any other. */
export type DiffMethElementMeta = {
	/** The class tested, or 'mixed' when the retained rows span more than one. Computed over the
	 * rows that survived filtering, not over the whole matrix. */
	element_class: string
	/** Which h5 path supplied the row ids — meta/element/elementID, meta/element_id, or
	 * meta/promoter/promoterID. Distinguishes a new build from a legacy promoter-only one. */
	id_source: string
	/** Whether the input was a tile matrix, i.e. whether rows carry tile_index. */
	is_tiled: boolean
	/** Elements that passed filtering and entered the model. */
	n_elements_tested: number
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
