export type DefaultVolcanoSettings = {
	/** Default color for significant data points. */
	defaultSignColor: string
	/** Default color for non-significant data points. */
	defaultNonSignColor: string
	/** Default color for highlighted data points. */
	defaultHighlightColor: string
	/** The fold change threshold to determine biological significance */
	foldChangeCutoff: number
	/** Height of the plot in pixels */
	height: number
	/** The p-value threshold to determine statistical significance */
	pValue: number
	/** Users may switch between 'original' and 'adjusted' p values */
	pValueType: 'original' | 'adjusted'
	/** Maximum number of samples to include in the analysis per termType */
	sampleNumCutoff: number
	/** Show the p-value table */
	showPValueTable: boolean
	/** Width of the plot in pixels */
	width: number
	/** Max number of interactive (overlay) dots to return from the server. The
	 * PNG still shows every dot — this only caps the SVG overlay the client
	 * renders on top. Capped to the most-significant rows. */
	maxInteractiveDots: number
	/** Max genes shown in the multi-gene hover tooltip when many dots overlap.
	 * Beyond this an "and N more" footer appears. */
	maxTooltipGenes: number
}

export type GEVolcanoSettings = DefaultVolcanoSettings & {
	/** The minimum normalized expression threshold to retain only genes with sufficient expression */
	cpmCutoff: number
	/** Toggle between analysis methods */
	method: 'edgeR' | 'wilcoxon' | 'limma'
	/** The smallest number of reads required for a gene to be considered in the analysis */
	minCount: number
	/** The smallest total number of reads required for a gene to be considered in the analysis */
	minTotalCount: number
	/*** NOT IN USE ***
	 * Rank genes by either the absolute value of the fold change or the variance */
	rankBy: 'abs(foldChange)' | 'pValue'
}

export type DMVolcanoSettings = DefaultVolcanoSettings & {
	/** Minimum non-NA samples required per group */
	minSamplesPerGroup: number
	/** Drop chrX/chrY promoters before testing */
	excludeSexChr: boolean
	/** Fit the eBayes prior variance as a function of average M-value */
	eBayesTrend: boolean
	/** Robust eBayes moderation against variance outliers */
	eBayesRobust: boolean
	/** Per-sample REML weights via limma arrayWeights(). Changes fold-changes, unlike the
	 * two eBayes options. */
	arrayWeights: boolean
	/** Which regulatory-element matrix to test, keying into
	 * ds.queries.dnaMethylation.elements server-side. 'promoter' is the default and is
	 * what the legacy single-matrix config resolves to. Changing this changes the rows
	 * being tested -- promoters, eQTM blocks, and cCRE classes are different features
	 * with different coordinates -- so it is not a display option. */
	elementType: string
	/** Block the design by each sample's parent entity (the patient), making the two-group
	 * comparison paired: the group effect is estimated from within-patient differences only.
	 * For longitudinal contrasts such as baseline vs relapse. Samples whose patient is not
	 * present in both groups are dropped server-side. */
	pairByParent: boolean
}

export type SCCTVolcanoSettings = DefaultVolcanoSettings & {}

export type SCGEVolcanoSettings = DefaultVolcanoSettings & {}

export type ValidatedVolcanoSettings = GEVolcanoSettings | DMVolcanoSettings | SCCTVolcanoSettings | SCGEVolcanoSettings
