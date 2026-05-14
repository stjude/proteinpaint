import { run_R } from '@sjcrh/proteinpaint-r'
import type { MultiomicRankingsClusterRequest, MultiomicRankingsClusterResponse, RouteApi } from '#types'
import { multiomicRankingsClusterPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'termdb/multiomicRankings/cluster',
	methods: {
		get: { ...multiomicRankingsClusterPayload, init },
		post: { ...multiomicRankingsClusterPayload, init }
	}
}

/**
 * Per-column z-score ignoring null cells.
 * Cells that were null remain null in the returned matrix.
 */
function zscorePerColumnIgnoringNull(matrix: (number | null)[][], ncol: number): (number | null)[][] {
	const out: (number | null)[][] = matrix.map(r => [...r])
	for (let c = 0; c < ncol; c++) {
		const vals: number[] = []
		for (const r of matrix) {
			const v = r[c]
			if (v !== null && v !== undefined && Number.isFinite(v as number)) vals.push(v as number)
		}
		if (vals.length === 0) continue
		const mean = vals.reduce((s, v) => s + v, 0) / vals.length
		const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
		for (let r = 0; r < matrix.length; r++) {
			const v = matrix[r][c]
			if (v === null || v === undefined || !Number.isFinite(v as number)) out[r][c] = null
			else out[r][c] = sd === 0 ? 0 : ((v as number) - mean) / sd
		}
	}
	return out
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const q: MultiomicRankingsClusterRequest = (req.method === 'POST' ? req.body : req.query) || ({} as any)
			const { row_names, col_names } = q
			if (!Array.isArray(q.matrix) || !Array.isArray(row_names) || !Array.isArray(col_names)) {
				throw 'matrix, row_names, and col_names are required'
			}
			if (col_names.length < 2) throw 'need at least 2 modalities to cluster'
			const minAssays = Math.max(2, q.minAssays ?? 3)

			// filter rows by min non-null cell count
			const keptRows: (number | null)[][] = []
			const keptNames: string[] = []
			for (let i = 0; i < q.matrix.length; i++) {
				const row = q.matrix[i]
				if (!Array.isArray(row) || row.length !== col_names.length) continue
				const nonNull = row.filter(v => v !== null && v !== undefined && Number.isFinite(v as number)).length
				if (nonNull < minAssays) continue
				keptRows.push(
					row.map(v => (v === null || v === undefined || !Number.isFinite(v as number) ? null : (v as number)))
				)
				keptNames.push(row_names[i])
			}
			if (keptRows.length < 3) throw `need at least 3 rows with ≥${minAssays} non-null values for clustering`

			// per-column z-score ignoring nulls (so missing cells don't bias the column mean/sd)
			const zMatrix = zscorePerColumnIgnoringNull(keptRows, col_names.length)

			// build the matrix passed to R: NA cells imputed to 0 (= column mean after z-score).
			// This is mean-imputation — missing cells contribute neutrally to row distances and
			// keeps the existing R-based hclust.R pipeline intact.
			const matrixForR: number[][] = zMatrix.map(row => row.map(v => (v === null ? 0 : (v as number))))

			const inputData = {
				matrix: matrixForR,
				row_names: keptNames,
				col_names,
				cluster_method: q.clusterMethod || 'average',
				distance_method: q.distanceMethod || 'euclidean',
				plot_image: false
			}

			const Routput = JSON.parse(await run_R('hclust.R', JSON.stringify(inputData)))

			// reorder z-scored matrix (with nulls preserved) by R's row order
			const rowOrderIdx: number[] = Routput.RowOrder.map((row: { name: string }) => keptNames.indexOf(row.name))
			const orderedMatrix: (number | null)[][] = rowOrderIdx.map(i => zMatrix[i])

			res.send({
				row: {
					merge: Routput.RowMerge,
					height: Routput.RowHeight,
					order: Routput.RowOrder,
					inputOrder: keptNames
				},
				usedRowNames: keptNames,
				usedColNames: col_names,
				matrix: orderedMatrix
			} satisfies MultiomicRankingsClusterResponse)
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e?.message || String(e) } satisfies MultiomicRankingsClusterResponse)
		}
	}
}
