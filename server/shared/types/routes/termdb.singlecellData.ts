import { ErrorResponse } from './errorResponse'

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
}

export type Plot = {
	/** name of the plot */
	name: string
	/** List of cells */
	cells: Cell[]
	/** Column name to color by, e.g Cell type, CNV, Fusion */
	colorBy: string
}

export type TermdbSinglecellDataRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** Sample name */
	sample: string
}

export type HasdataResponse = {
	/** List of plots from singlecell experiment of this sample */
	plots: Plot[]

	/** Cell annotations. key: termId, value: {cellId: value}. assumption is that same set of annotations apply to all plots */
	//tid2cellvalue: {}

	/** Terms used to annotate cells */
	//terms: Term[]
}

export type NodataResponse = {
	/** Flag to indicate no sc data for this sample */
	nodata: boolean
}

export type TermdbSinglecellDataResponse = NodataResponse | ErrorResponse | HasdataResponse
