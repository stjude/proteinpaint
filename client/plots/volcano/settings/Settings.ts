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
	/** Recentre the Δβ axis on the median across all tested elements, so the origin is the
	 * typical element rather than zero. See the checkbox title for when it is the right question
	 * to ask, and the server's centerX for what it does. */
	centerDeltaBeta: boolean
	/** Which regulatory-element matrix to test, keying into
	 * ds.queries.dnaMethylation.elements server-side. 'promoter' is the default and is
	 * what the legacy single-matrix config resolves to. Changing this changes the rows
	 * being tested -- promoters, eQTM blocks, and cCRE classes are different features
	 * with different coordinates -- so it is not a display option. */
	elementType: string
	/** Which quantity the x axis shows. 'fold_change' is the difference of M-values (a logit);
	 * 'delta_beta' is the difference in average beta, i.e. how much methylation actually changed,
	 * on the 0-1 scale the biology is discussed in. Both are case minus control, so the sign and
	 * the ordering agree — only the units differ. */
	xAxis: 'fold_change' | 'delta_beta'
	/** Effect-size cutoff applied when xAxis is 'delta_beta'. Kept separate from
	 * foldChangeCutoff because the two are not interchangeable: 0.3 is a modest logit shift but
	 * a 30-percentage-point methylation change, which almost nothing clears. */
	deltaBetaCutoff: number
}

export type SCCTVolcanoSettings = DefaultVolcanoSettings & {}

export type SCGEVolcanoSettings = DefaultVolcanoSettings & {}

export type ValidatedVolcanoSettings = GEVolcanoSettings | DMVolcanoSettings | SCCTVolcanoSettings | SCGEVolcanoSettings
