import type { RoutePayload } from './routeApi.js'

export type MultiomicRankingsClusterRequest = {
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

export type MultiomicRankingsClusterResponse = {
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

export const multiomicRankingsClusterPayload: RoutePayload = {
	request: {
		typeId: 'MultiomicRankingsClusterRequest'
	},
	response: {
		typeId: 'MultiomicRankingsClusterResponse'
	}
}
