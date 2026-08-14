import type { DataEntry, VolcanoData, VolcanoRenderRequest } from './termdb.DE.js'

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
	/** Drop chrX/chrY promoters before testing (default false). X-inactivation makes
	 * chrX methylation strongly sex-dependent, so a sex-imbalanced comparison produces
	 * chrX hits that are sex rather than the grouping variable. */
	exclude_sex_chr?: boolean
	/** Fit the eBayes prior variance as a function of average M-value (default false).
	 * M-value variance is mean-dependent, so a single prior over- and under-shrinks
	 * opposite ends of the methylation range. */
	ebayes_trend?: boolean
	/** Robust eBayes moderation (default false): down-weight variance outliers when
	 * estimating hyperparameters so a few wild promoters cannot drag the prior. */
	ebayes_robust?: boolean
	/** Per-sample REML weights via limma arrayWeights() (default false). Unlike the two
	 * eBayes options this acts across samples rather than across promoters, and it does
	 * change the fitted fold-changes. Guards against a single aberrant sample dominating
	 * a small group, and against unequal variance between two very unbalanced arms. */
	array_weights?: boolean
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
	/** Group 1 (control) mean beta, over observed cells only */
	mean_beta_control: number
	/** Group 2 (case) mean beta, over observed cells only */
	mean_beta_case: number
	/** mean_beta_case - mean_beta_control. The interpretable effect size: fold_change is a
	 * difference of M-values (a logit), so it does not say how much methylation changed.
	 * Same sign as fold_change, since both are case - control. Derived by back-transforming
	 * the stored M-values, which yields the alpha-smoothed beta and so shrinks the difference
	 * toward zero by 2/(depth+2) — under 1% at this cohort's typical promoter depth. */
	delta_beta: number
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
