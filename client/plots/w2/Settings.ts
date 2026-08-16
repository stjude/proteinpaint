type Settings = {
	/** index of the selected row in the sample table; -1 = no sample selected */
	selectedSampleIndex: number
	/** viewer height, any CSS length */
	viewerHeight: string
	/** spatial images only — burger-menu overrides of the dataset's viewer settings */
	showCellBoundaries: boolean
	showNucleusBoundaries: boolean
	/** comma-separated gene names; null = dataset default, '' = no overlay */
	geneExpression: string | null
	/** show boundary strokes only in the n most zoomed-in levels; null = dataset default, 0 = always show */
	annotationLevel: number | null
	/** overlay each gene in its own color, or sum all genes into one overlay */
	spatialMode: 'gene_expression' | 'gene_groups'
}

export default Settings
