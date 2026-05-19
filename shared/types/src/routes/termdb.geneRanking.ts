export type GeneRankingRequest =
	| {
			/** fetch a ranking TSV (or list of available keys when key is omitted) */
			for?: 'data'
			genome: string
			dslabel: string
			/** when omitted, server returns the list of available keys */
			key?: string
	  }
	| {
			/** run hierarchical clustering on a client-built matrix */
			for: 'cluster'
			/** numeric matrix; rows = genes, cols = modalities. May contain nulls (treated as missing). */
			matrix: (number | null)[][]
			/** gene names, length = matrix.length */
			row_names: string[]
			/** modality names, length = matrix[0].length */
			col_names: string[]
			/** linkage method, default 'average' */
			clusterMethod?: string
			/** distance metric, default 'euclidean' */
			distanceMethod?: string
			/** minimum number of non-null cells required for a row to be included, default 3 */
			minAssays?: number
	  }

export type GeneRankingResponse = {
	// 'data' mode
	/** available ranking keys when no key was supplied */
	keys?: string[]
	/** column labels in file order */
	columns?: string[]
	/** rows of cell values; numeric where possible, string otherwise */
	rows?: (string | number | null)[][]

	// 'cluster' mode
	/** hclust output for rows */
	row?: {
		merge: { n1: number; n2: number }[]
		height: { height: number }[]
		order: { name: string }[]
		inputOrder: string[]
	}
	/** input gene order after rows below minAssays threshold were dropped */
	usedRowNames?: string[]
	/** input modality order (echoed back) */
	usedColNames?: string[]
	/** z-scored (per column, ignoring nulls) matrix, reordered by row dendrogram order. Null = missing. */
	matrix?: (number | null)[][]

	error?: string
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
