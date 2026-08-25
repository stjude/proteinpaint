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
