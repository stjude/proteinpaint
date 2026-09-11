export type DERequest = {
	/** Discriminator tag. Matches the `kind` field on `DeCacheResult` and
	 * lets the GSEA route tell a snapshot DE request apart from a snapshot
	 * DM request without structural-shape probing. */
	kind: 'DE'
	/** Genome build name */
	genome: string
	/** dataset label */
	dslabel: string
	/* Object containing two arrays of RNA seq count for DE analysis */
	samplelst: any //{number[]; number[];}
	/** Minimum count per sample for edgeR's filterByExpr */
	min_count: number
	/** Minimum total count across samples for edgeR's filterByExpr */
	min_total_count: number
	/** Minimum normalized expression threshold to retain only genes with sufficient expression */
	cpm_cutoff: number
	/** Method of DE used wilcoxon/edgeR */
	method?: string
	/** Term for confounding variable1 (if present) */
	tw?: any
	/** Term for confounding variable2 (if present) */
	tw2?: any
	/** Option to return early with actual number of samples with expression values */
	preAnalysis?: boolean
	/** Parameters for the server-side `da` Rust renderer: significance thresholds,
	 * PNG dimensions, and dot styling. The server always renders the volcano PNG
	 * and returns it plus the threshold-passing rows as the interactive `data`. */
	volcanoRender: VolcanoRenderRequest
	/** if present, loads data from pseudobulk. otherwise loads from rnaseqGeneCount
	 */
	pseudobulk?: {
		assay: string
		memberId: string
		category: string
	}
	signal?: any
}

/** Thresholds used to classify a data point as "significant" on the volcano plot.
 * Shared across DE, diffMeth, and singlecellDEgenes routes. */
export type SignificanceThresholds = {
	/** Cutoff on the -log10 scale; rows with -log10(p) > pValueCutoff pass. */
	pValueCutoff: number
	/** Which p-value column to threshold against. */
	pValueType: 'adjusted' | 'original'
	/** Log2 fold-change magnitude; rows with |fold_change| > foldChangeCutoff pass. */
	foldChangeCutoff: number
}

/** Options the client sends when it wants the server to render the volcano PNG. */
export type VolcanoRenderRequest = {
	significanceThresholds: SignificanceThresholds
	/** Which row field supplies the x coordinate. Defaults to 'fold_change'.
	 *
	 * Differential methylation can plot 'delta_beta' instead: fold_change there is a difference
	 * of M-values, a logit, so it orders elements correctly but its magnitude does not say how
	 * much methylation changed. Delta-beta does, on the 0-1 scale the biology is discussed in.
	 *
	 * Whichever field is chosen, significanceThresholds.foldChangeCutoff is interpreted in THAT
	 * field's units -- the caller sends the cutoff matching the axis it asked for. Otherwise the
	 * threshold lines would sit at coordinates unrelated to what is classified significant. */
	xField?: 'fold_change' | 'delta_beta'
	/** Recentre the x axis on the median effect size across all tested rows, so the origin is the
	 * typical row rather than zero. Off by default.
	 *
	 * For direction counts on a contrast carrying a baseline offset: at a symmetric cutoff around
	 * zero, an offset distribution clears the up threshold more easily than the down one, which
	 * skews the up:down ratio independently of any per-row biology. Turning this on answers
	 * "which rows moved more than the typical row" instead of "which rows moved from zero".
	 *
	 * Moves only the plotted and classified value. P-values are untouched and the returned rows
	 * keep their raw effect sizes, so a downloaded table reads the same either way. */
	centerX?: boolean
	/** Target PNG width in pixels. */
	pixelWidth: number
	/** Target PNG height in pixels. */
	pixelHeight: number
	/** Default color for significant dots when no group colors are supplied. */
	colorSignificant?: string
	/** Color for significant dots with positive fold change (case group). */
	colorSignificantUp?: string
	/** Color for significant dots with negative fold change (control group). */
	colorSignificantDown?: string
	/** Color for non-significant dots. */
	colorNonsignificant?: string
	/** Ring radius in PNG pixels. Should match the client overlay's circle
	 * radius so PNG rings align with interactive overlay rings. */
	dotRadius?: number
	/** Maximum number of interactive rows to return in `data` (the overlay).
	 * The server still renders every row into `volcanoPng`; this only caps the
	 * interactive list. Capped to the most-significant rows (smallest p-value).
	 * `null` lifts the cap and returns every significant row -- what the table
	 * download sends, so the file is complete while the overlay stays capped. */
	maxInteractiveDots?: number | null
	/** Hi-DPI scale factor from `window.devicePixelRatio` (e.g. 2.0 on retina).
	 * The PNG is rasterized at `pixelWidth*dpr × pixelHeight*dpr` device pixels
	 * but reported (and rendered in the SVG) at the CSS-space dimensions, so
	 * the browser uses the extra resolution for sharpness. Defaults to 1.0
	 * server-side. */
	devicePixelRatio?: number
	signal?: any
}

/** Everything the client needs to draw one volcano: the pre-rendered PNG of
 * the full scatter, the coordinate extents that produced it, the subset of
 * rows to overlay as interactive dots, and the total row count (for stats).
 * Routes nest this under `data` on their response, keeping route-specific
 * metadata (sample sizes, method, etc.) next to it. */
export type VolcanoData<T extends DataEntry> = {
	/** Interactive dots for the overlay: rows that passed the client's
	 * significance thresholds, sorted ascending by the chosen p-value column,
	 * capped at `maxInteractiveDots`. Each entry is one dot, not one volcano. */
	dots: T[]
	/** Base64-encoded PNG of the full scatter (every row). */
	volcanoPng: string
	/** Coordinate extents of the PNG; client overlay circles are positioned
	 * against these so they land on their counterparts in the rendered image. */
	plotExtent: PlotExtent
	/** Total rows rendered into the PNG. Used client-side for "% significant"
	 * stats since the full row list is not transmitted. */
	totalRows: number
	/** Rows that passed significance thresholds, before any maxInteractiveDots
	 * truncation. Use this (not dots.length) for "% significant" stats. */
	totalSignificantRows: number
	/** The same significant rows split by direction of effect: `up` is positive on whichever
	 * field xField selected, matching how the PNG colours them. Summed over ALL significant
	 * rows, so unlike counting `dots` these stay correct under maxInteractiveDots — which
	 * matters because the most-significant rows are not direction-balanced.
	 *
	 * What "up" MEANS is the caller's to name: higher in group 2 (the case group) for
	 * expression, hypermethylated for methylation. */
	totalSignificantUp: number
	totalSignificantDown: number
	/** The value subtracted from every plotted x when centerX was requested — the median effect
	 * size across all tested rows, and 0 when centring was off. Report it alongside a centred
	 * count: it is the size of the baseline offset that was removed. */
	xOffset: number
	/** Server-side cache ID for the full DE result (all rows, not just dots).
	 * Downstream tools (e.g. GSEA) pass this back to the server instead of
	 * re-transmitting the gene + fold_change arrays. */
	cacheId?: string
}

/** Coordinate metadata returned by the `volcano` renderer, used by the client to overlay
 * interactive top-significant circles on top of the server-drawn PNG. */
export type PlotExtent = {
	/** Padded data-space x domain — used to position overlay dots so points near
	 * the real-data edges stay fully visible (mirror of manhattan's yPlot domain). */
	xMin: number
	xMax: number
	/** Padded data-space y domain (on -log10 p-value scale). */
	yMin: number
	yMax: number
	/** Unpadded data-space x domain — used for the visible axis labels/ticks
	 * so the axis only spans the real data region. */
	xMinUnpadded: number
	xMaxUnpadded: number
	/** Unpadded data-space y domain. */
	yMinUnpadded: number
	yMaxUnpadded: number
	/** Dot radius in pixels (echoed back so overlay rings match the PNG). */
	dotRadiusPx: number
	/** PNG canvas dimensions (already include 2*dotRadiusPx of padding). */
	pixelWidth: number
	pixelHeight: number
	/** Inner drawing rect inside the PNG (after axis margins). Client overlay circles
	 * must position against this rect, not the full canvas. */
	plotLeft: number
	plotTop: number
	plotRight: number
	plotBottom: number
	/** The smallest non-zero p-value observed in the input rows. Rows with p == 0
	 * were drawn at y = -log10(minNonZeroPValue) in the PNG; the client must reuse
	 * this cap when positioning overlay circles so they align with the PNG. */
	minNonZeroPValue: number
}

export type ExpressionInput = {
	/** Case samples separated by , */
	case: string
	/** Control samples separated by , */
	control: string
	/** data_type instructs rust to carry out differential gene expression analysis */
	data_type: 'do_DE'
	/** File containing raw gene counts for DE analysis */
	input_file: string
	/** Confounding variable1 for DE analysis. Maybe array of string (Gender: Male/female) or number (Age). For now supporting 1 confounding variable. */
	conf1?: any[]
	/** Type of the confounding variable1 (continuous/discrete) */
	conf1_mode?: 'continuous' | 'discrete'
	/** Confounding variable2 for DE analysis. Maybe array of string (Gender: Male/female) or number (Age). For now supporting 1 confounding variable. */
	conf2?: any[]
	/** Type of the confounding variable2 (continuous/discrete) */
	conf2_mode?: 'continuous' | 'discrete'
	/** Number of variable genes to be included for DE analysis (optional) */
	VarGenes?: number
	/** The methodology used for differential gene expression: wilcoxon, edgeR and limma */
	DE_method: 'wilcoxon' | 'limma' | 'edgeR'
	/** Cutoff for when mds plot will be generated for edgeR and limma test */
	mds_cutoff: number
	/** Minimum count per sample for edgeR's filterByExpr */
	min_count: number
	/** Minimum total count across samples for edgeR's filterByExpr */
	min_total_count: number
	/** Minimum normalized expression threshold to retain only genes with sufficient expression */
	cpm_cutoff: number
	/** Server-cache directory passed through to R (used as a working dir
	 * for any intermediate writes the R script doesn't have an explicit
	 * path for). Set by the server, not the client. */
	cachedir?: string
}

/** What a build-on-demand dataset can say about the counts files behind a run, before
 * running it: which files back the requested cases, how the one-file-per-case choice was
 * made, and how much of the fetch is already on disk. Produced by
 * RnaseqGeneCount.previewCountsFiles; gdc is the only implementer today. */
export type CountsFilePreview = {
	/** cases the run asked about */
	casesRequested: number
	/** cases that actually have a usable counts file; <= casesRequested */
	cases: number
	/** counts files found across those cases, before one-per-case selection */
	candidateFiles: number
	/** cases that had more than one candidate file. always the true count, even when
	 * multiCases[] below is capped */
	casesWithMultiple: number
	/** the chosen files broken down by the tissue type of the aliquot each came from */
	byTissueType: Record<string, number>
	/** per-case detail for the multi-file cases, capped by the dataset */
	multiCases: { case: string; chosen: string; candidates: { file_id: string; tissueType: string }[] }[]
	/** true when multiCases[] was capped */
	multiCasesTruncated: boolean
	/** human-readable statement of how the one file per case was chosen */
	selectionRule: string
	/** false when the dataset could not tell what its cached files are keyed on, in which case
	 * cached/toDownload are absent rather than guessed */
	axisKnown: boolean
	/** true when the whole matrix is already assembled, so the run fetches nothing */
	matrixCached?: boolean
	/** files already on disk */
	cached?: number
	/** files the run would download */
	toDownload?: number
	/** when the cache key this estimate rests on was last established */
	axisSeenAt?: string
}

/** Response when DERequest.preAnalysis === true. Returns per-group sample
 * counts (keyed by group name) plus an optional validation alert. No volcano
 * is rendered; the client uses this to show counts before the user submits. */
export type DEPreAnalysisResponse = {
	/** number of samples with expression data, keyed by group name. a group name is
	 * user-supplied, so it must not share this object with any other property */
	data: Record<string, number>
	/** validation message; the client hides the run button while it is present */
	alert?: string
	/** only for datasets that build their counts matrix on demand; absent otherwise, and
	 * absent when the preview query itself failed -- it is descriptive, so a failure there
	 * must not fail the pre-analysis */
	countsFiles?: CountsFilePreview
}

/** Response for a full DE run (DERequest.preAnalysis absent/false). */
export type DEFullResponse = {
	/** The volcano payload — per-gene interactive dots + PNG + extents + totals.
	 * See VolcanoData for details. */
	data: VolcanoData<GeneDEEntry>
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
	/** Method of DE used wilcoxon/edgeR */
	method: string
	/** QL: Image describing the quality of the fitting from QL pipeline, this is only generated for edgeR not for wilcoxon method  */
	/** MDS: Image showing the MDS plot of samples from both groups, this is only generated for edgeR not for wilcoxon method */
	images?: DEImage[]
	/** Biological coefficient of variation (BCV), this is only generated for edgeR*/
	bcv?: number
}

export type DEResponse = DEPreAnalysisResponse | DEFullResponse

/** Shared base shape for a single row of differential analysis results — i.e.
 * one dot in a volcano. Used by DE (gene expression), diff methylation, and
 * singlecell DE genes, each of which extends this with route-specific fields. */
export type DataEntry = {
	original_p_value: number
	adjusted_p_value?: number
	fold_change: number
}

export type GeneDEEntry = DataEntry & {
	gene_id: string
	gene_name: string
}

export type DEImage = {
	/** Image source */
	src: string
	/** File size */
	size: number
	/** Image identifier */
	key: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
