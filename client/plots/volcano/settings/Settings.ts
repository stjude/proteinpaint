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
}

export type SCCTVolcanoSettings = DefaultVolcanoSettings & {}

export type ValidatedVolcanoSettings = GEVolcanoSettings | DMVolcanoSettings | SCCTVolcanoSettings
