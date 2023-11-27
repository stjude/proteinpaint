export type Cell = {
	/** Cell id or barcode */
	cellId: string
	/** X coord of the cell */
	x: number
	/** Y coord of the cell */
	y: number
	/** Z coord of the cell, should be present for all cells and trigger 3d plot   */
	z?: number
}

export type Plot = {
	/** name of the plot */
	name: string
	/** List of cells */
	cells: Cell[]
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

export type ErrorResponse = {
	/** Error msg */
	error: string
}
export type TermdbSinglecellDataResponse = NodataResponse | ErrorResponse | HasdataResponse
