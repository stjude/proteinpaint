import type { ErrorResponse } from './errorResponse.ts'

export type Cell = {
	/** Cell id or barcode */
	cellId: string
	/** X coord of the cell */
	x: number
	/** Y coord of the cell */
	y: number
	/** Z coord of the cell, should be present for all cells and trigger 3d plot   */
	z?: number
	/** The cell may have different classifications, e.g. by cell type, CNV, FUSION, etc. */
	category: string
	/** Gene expression data for this cell */
	geneExp?: number
}

export type Plot = {
	/** name of the plot */
	name: string
	/** List of cells with gene expression */
	expCells: Cell[]
	/** List of cells with no gene expression, if no gene provided all cells will be here */
	noExpCells: Cell[]
	colorColumns: string[]
	colorBy: string
	colorMap: any
}

export type TermdbSingleCellDataRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample name for which the sc results will be shown.
	for GDC the value is "seurat.analysis.tsv" file UUID rather than any sample name. the file contains the analysis results for an experiment */
	sample: { eID?: string; sID: string }
	/** List of plot names from this sample to request data for */
	plots: string[]
	/** check plot availability for this sample, will not return actual plot data and speed up */
	checkPlotAvailability?: boolean
	/** Gene name to retrieve expression data for all cells of the given sample, and to overlay on maps */
	gene?: string
	genes?: string[]
	/** List the gene names present in this sample's expression store (e.g. to
	offer/validate exactly the sample's assayed genes in a search box, which
	may differ from the genome gene db) instead of returning plot data */
	listGenes?: boolean
	/** in each plot, what Column name to color by 
	key: plot.name, value: column name
	if missing, use default setting of the plot
	*/
	// colorBy?: { [key: string]: string }
	colorBy?: string
	colorMap?: { [key: string]: string }
	singleCellPlot?: any
}

export type HasdataResponse = {
	/** List of plots from singlecell experiment of this sample */
	plots: Plot[]
}

export type NodataResponse = {
	/** Flag to indicate no sc data for this sample */
	nodata: boolean
}

export type GeneListResponse = {
	/** answer to listGenes: the sample's assay type, declared by the store's
	own 'assay' attribute. 'panel' = a small assayed subset of the genome,
	'wholeTranscriptome' = all genes (the default for stores without the
	attribute) */
	assay: 'panel' | 'wholeTranscriptome'
	/** the assayed genes; present only for a panel-based sample — a
	whole-transcriptome sample keeps gene search on the genome gene db */
	genes?: string[]
}

export type TermdbSingleCellDataResponse = NodataResponse | ErrorResponse | HasdataResponse | GeneListResponse

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
