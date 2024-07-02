import { ErrorResponse } from './errorResponse.ts'

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
	/** List of cells */
	cells: Cell[]
	/** Column name to color by, e.g Cell type, CNV, Fusion */
	colorBy: string
	colorMap?: { [key: string]: string }
}

export type TermdbSinglecellDataRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample name */
	sample: string
	/** List of plot names from this sample to request data for */
	plots: string[]
}

export type HasdataResponse = {
	/** List of plots from singlecell experiment of this sample */
	plots: Plot[]

	/** Terms used to annotate cells */
	//terms: Term[]
}

export type NodataResponse = {
	/** Flag to indicate no sc data for this sample */
	nodata: boolean
}

export type TermdbSinglecellDataResponse = NodataResponse | ErrorResponse | HasdataResponse
