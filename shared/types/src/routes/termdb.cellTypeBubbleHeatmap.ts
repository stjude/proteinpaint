import type { ErrorResponse } from './errorResponse.ts'

export type CellTypeBubbleHeatmapRequest = {
	genome: string
	dslabel: string
	gene: string
}

/** One protein-level measurement for one cohort cell (celltype+genotype × timepoint).
 *  Each cell carries exactly one value: the gene's most-significant (lowest-FDR) row in
 *  that cohort's DAPfile for the selected isoform. */
export type CellTypeBubbleCell = {
	/** the DAPfile `identifier` column (protein id) */
	id: string
	/** raw log2 fold change from the DAPfile */
	log2FC: number
	/** FDR from the DAPfile (its p-value column is already an adjusted p-value) */
	fdr: number
	/** true when fdr < the response's fdrThreshold; non-significant cells are
	 *  still returned and drawn faded by the client */
	significant: boolean
}

/** One column of the grid: a cell type + genotype pair, e.g. cellType='MG1',
 *  genotype='APPKI', key='MG1_APPKI'. */
export type CellTypeBubbleColumn = {
	key: string
	cellType: string
	genotype: string
}

/** One row of the grid: a timepoint, e.g. key='8m', label='8m'. */
export type CellTypeBubbleRow = {
	key: string
	label: string
}

export type CellTypeBubbleHeatmapIsoform = {
	gene_name: string
	/** data[columnKey][rowKey] → cell (omitted when the cohort doesn't exist for that
	 *  celltype+genotype+timepoint, e.g. OPC has no 4m, or the gene has no row in the
	 *  DAPfile) */
	data: {
		[columnKey: string]: {
			[rowKey: string]: CellTypeBubbleCell
		}
	}
}

export type CellTypeBubbleHeatmapResponse =
	| ErrorResponse
	| {
			isoforms: { [isoformId: string]: CellTypeBubbleHeatmapIsoform }
			/** column order, left-to-right (cell type × genotype) */
			columns: CellTypeBubbleColumn[]
			/** row order, top-to-bottom (timepoints) */
			rows: CellTypeBubbleRow[]
			/** FDR threshold below which a cell is significant; cells with
			 *  FDR ≥ threshold are returned with significant:false and drawn faded */
			fdrThreshold: number
	  }
