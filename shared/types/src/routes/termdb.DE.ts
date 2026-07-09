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
	 * interactive list. Capped to the most-significant rows (smallest p-value). */
	maxInteractiveDots?: number
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

/** Response when DERequest.preAnalysis === true. Returns per-group sample
 * counts (keyed by group name) plus an optional validation alert. No volcano
 * is rendered; the client uses this to show counts before the user submits. */
export type DEPreAnalysisResponse = {
	data: Record<string, number | string>
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
