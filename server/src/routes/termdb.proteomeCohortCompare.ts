import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import serverconfig from '#src/serverconfig.js'
import { run_R } from '@sjcrh/proteinpaint-r'

/*
Cross-cohort proteome comparison via standardized fold change (log2FC-z).

For each selected cohort we read its DAPfile (acc \t identifier \t gene \t log2FC \t FDR),
collapse to one row per gene by keeping the most-significant row (lowest p), then standardize:

	z = (log2FC − μ) / σ        (definition (a): μ, σ = mean & SD of the cohort's log2FC)

Cohorts are aligned on the shared gene axis (intersection). Same-species matches by the gene
symbol as-is; cross-species (opt-in) matches by upper-cased symbol (human APP ↔ mouse App).
Returns the aligned z matrix plus pairwise Pearson (on z) and Spearman (on ranks) correlations.
*/

export const api: RouteApi = {
	endpoint: 'termdb/proteomeCohortCompare',
	methods: {
		get: { init, request: { typeId: 'any' }, response: { typeId: 'any' } } as RoutePayload,
		post: { init, request: { typeId: 'any' }, response: { typeId: 'any' } } as RoutePayload
	}
}

type CohortRef = { organism: string; assay: string; cohort: string; label?: string }
type GeneStat = { fc: number; p: number; z: number }

/** collapse a cohort's DAP to one most-significant row per gene, then z-standardize the log2FC.
 *  geneKeyed by the raw gene symbol, or upper-cased when crossSpecies. Returns null if unreadable. */
async function loadCohortZ(filePath: string, crossSpecies: boolean): Promise<Map<string, GeneStat> | null> {
	let content: string
	try {
		content = await fs.readFile(filePath, 'utf8')
	} catch {
		return null
	}
	// one most-significant row per gene key
	const best = new Map<string, { fc: number; p: number }>()
	const lines = content.trim().split('\n')
	for (let i = 1; i < lines.length; i++) {
		const parts = lines[i].split('\t')
		if (parts.length < 5) continue
		const geneRaw = parts[2]
		if (!geneRaw) continue
		const fc = Number(parts[3])
		if (!Number.isFinite(fc)) continue
		const p = Number(parts[4])
		if (!Number.isFinite(p)) continue
		const key = crossSpecies ? geneRaw.toUpperCase() : geneRaw
		const cur = best.get(key)
		if (!cur || p < cur.p) best.set(key, { fc, p })
	}
	if (best.size === 0) return null

	// standardize log2FC across the cohort's genes (definition (a): mean & SD)
	let sum = 0
	for (const v of best.values()) sum += v.fc
	const mean = sum / best.size
	let ss = 0
	for (const v of best.values()) ss += (v.fc - mean) ** 2
	const sd = Math.sqrt(ss / best.size)

	//the DAP file's p-value column is already an FDR (adjusted p) — used directly as significance
	const out = new Map<string, GeneStat>()
	for (const [g, v] of best) out.set(g, { fc: v.fc, p: v.p, z: sd > 0 ? (v.fc - mean) / sd : 0 })
	return out
}

function pearson(a: number[], b: number[]): number {
	const n = a.length
	if (n < 2) return NaN
	let ma = 0,
		mb = 0
	for (let i = 0; i < n; i++) {
		ma += a[i]
		mb += b[i]
	}
	ma /= n
	mb /= n
	let num = 0,
		da = 0,
		db = 0
	for (let i = 0; i < n; i++) {
		const x = a[i] - ma,
			y = b[i] - mb
		num += x * y
		da += x * x
		db += y * y
	}
	return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN
}

/** fractional ranks (ties → average rank), for Spearman */
function ranks(arr: number[]): number[] {
	const idx = arr.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0])
	const r = new Array<number>(arr.length)
	let i = 0
	while (i < idx.length) {
		let j = i
		while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
		const avg = (i + j) / 2 + 1
		for (let k = i; k <= j; k++) r[idx[k][1]] = avg
		i = j + 1
	}
	return r
}

/** hclust output for one axis, in the client-friendly shape */
type Hclust = {
	merge: { n1: number; n2: number }[]
	height: { height: number }[]
	order: { name: string }[]
	inputOrder: string[]
}

/**
 * Build the protein × cohort log2FC-z heatmap: rows = proteins that are a DAP (|z|≥zThresh &
 * FDR≤fdrThresh) in ≥1 cohort, capped at the top `maxRows` by variance of z across cohorts;
 * both axes clustered by run_R('hclust.R') — the same engine hierCluster uses. z/fc/fdr are
 * returned reordered by the dendrogram leaf order.
 */
async function buildHeatmap(
	cohortLabels: string[],
	genes: string[],
	z: number[][],
	fc: number[][],
	p: number[][],
	zThresh: number,
	fdrThresh: number,
	maxRows: number
) {
	const nCoh = z.length
	// DAP-union candidate rows (over the shared genes)
	const isDap = (c: number, i: number) => Math.abs(z[c][i]) >= zThresh && p[c][i] <= fdrThresh
	const cand: number[] = []
	for (let i = 0; i < genes.length; i++) {
		for (let c = 0; c < nCoh; c++)
			if (isDap(c, i)) {
				cand.push(i)
				break
			}
	}
	const totalDap = cand.length
	// cap by variance of z across cohorts (most cross-cohort-variable first)
	const variance = (i: number) => {
		let m = 0
		for (let c = 0; c < nCoh; c++) m += z[c][i]
		m /= nCoh
		let s = 0
		for (let c = 0; c < nCoh; c++) s += (z[c][i] - m) ** 2
		return s / nCoh
	}
	cand.sort((a, b) => variance(b) - variance(a))
	const rows = cand.slice(0, Math.max(0, maxRows))
	const rowNames = rows.map(i => genes[i])
	// matrix [row][col] of z; column ids kept unique for R (labels may collide)
	const colIds = cohortLabels.map((_, c) => `c${c}`)
	const M = rows.map(i => z.map(zc => zc[i]))

	let rowOrderIdx = rows.map((_, r) => r)
	let colOrderIdx = cohortLabels.map((_, c) => c)
	let rowDendrogram: Hclust | null = null
	let colDendrogram: Hclust | null = null

	if (rows.length >= 3 && nCoh >= 2) {
		const inputData = {
			matrix: M,
			row_names: rowNames,
			col_names: colIds,
			cluster_method: 'average',
			distance_method: 'euclidean',
			plot_image: false
		}
		const R = JSON.parse(await run_R('hclust.R', JSON.stringify(inputData)))
		rowOrderIdx = R.RowOrder.map((o: { name: string }) => rowNames.indexOf(o.name))
		colOrderIdx = R.ColOrder.map((o: { name: string }) => colIds.indexOf(o.name))
		rowDendrogram = { merge: R.RowMerge, height: R.RowHeight, order: R.RowOrder, inputOrder: rowNames }
		colDendrogram = { merge: R.ColumnMerge, height: R.ColumnHeight, order: R.ColOrder, inputOrder: colIds }
	}

	const reorder = (mat: number[][]) => rowOrderIdx.map(r => colOrderIdx.map(c => mat[r][c]))
	const fcRows = rows.map(i => fc.map(v => v[i]))
	const fdrRows = rows.map(i => p.map(v => v[i]))

	return {
		rowNames: rowOrderIdx.map(r => rowNames[r]),
		colLabels: colOrderIdx.map(c => cohortLabels[c]),
		z: reorder(M),
		fc: reorder(fcRows),
		fdr: reorder(fdrRows),
		rowDendrogram,
		colDendrogram,
		totalDap,
		shown: rows.length
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const organisms = ds.queries?.proteome?.organisms
			if (!organisms) throw 'proteome not configured for this dataset'

			const cohorts: CohortRef[] = typeof q.cohorts === 'string' ? JSON.parse(q.cohorts) : q.cohorts
			if (!Array.isArray(cohorts) || cohorts.length < 2) throw 'at least two cohorts are required'
			const crossSpecies = q.crossSpecies === true || q.crossSpecies === 'true'

			// species guard — refuse silent cross-species mixing unless opted in
			const speciesSet = new Set(cohorts.map(c => c.organism))
			if (speciesSet.size > 1 && !crossSpecies) {
				throw {
					status: 400,
					error:
						'Selected cohorts span multiple species. Enable cross-species comparison to compare them by ortholog symbol.'
				}
			}

			// load + standardize each cohort
			const maps: (Map<string, GeneStat> | null)[] = []
			for (const c of cohorts) {
				const cc = organisms[c.organism]?.assays?.[c.assay]?.cohorts?.[c.cohort]
				if (!cc?.DAPfile) throw `no DAPfile for ${c.organism}/${c.assay}/${c.cohort}`
				maps.push(await loadCohortZ(path.join(serverconfig.tpmasterdir, cc.DAPfile), crossSpecies))
			}
			maps.forEach((m, i) => {
				if (!m) throw `could not read DAP for ${cohorts[i].cohort}`
			})

			// shared gene axis = intersection across all cohorts
			let shared = [...maps[0]!.keys()]
			for (let i = 1; i < maps.length; i++) {
				const m = maps[i]!
				shared = shared.filter(g => m.has(g))
			}
			shared.sort()

			// aligned matrices (cohort × gene)
			const z: number[][] = maps.map(m => shared.map(g => m!.get(g)!.z))
			const fc: number[][] = maps.map(m => shared.map(g => m!.get(g)!.fc))
			const p: number[][] = maps.map(m => shared.map(g => m!.get(g)!.p))

			// pairwise correlations
			const zr = z.map(ranks)
			const pearsonM: number[][] = []
			const spearmanM: number[][] = []
			for (let i = 0; i < z.length; i++) {
				pearsonM[i] = []
				spearmanM[i] = []
				for (let j = 0; j < z.length; j++) {
					pearsonM[i][j] = i === j ? 1 : pearson(z[i], z[j])
					spearmanM[i][j] = i === j ? 1 : pearson(zr[i], zr[j])
				}
			}

			// optional protein × cohort clustered heatmap (rows = DAP-union, both axes clustered)
			let heatmap: any = undefined
			if (q.heatmap === true || q.heatmap === 'true') {
				// finite-check (not `||`) so a user-supplied 0 (e.g. |z| ≥ 0) isn't swallowed by the default
				const num = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def)
				const zThresh = num(q.zThresh, 2)
				const fdrThresh = num(q.fdrThresh, 0.05)
				const maxRows = num(q.maxRows, 30)
				const cohortLabels = cohorts.map(c => c.label || c.cohort)
				heatmap = await buildHeatmap(cohortLabels, shared, z, fc, p, zThresh, fdrThresh, maxRows)
			}

			res.send({
				cohorts: cohorts.map((c, i) => ({ ...c, geneCount: maps[i]!.size })),
				crossSpecies,
				genes: shared,
				sharedGeneCount: shared.length,
				z,
				fc,
				p,
				pearson: pearsonM,
				spearman: spearmanM,
				heatmap
			})
		} catch (e: any) {
			const status = typeof e?.status === 'number' ? e.status : 400
			// e may be an Error, a plain {status,error} object, or a bare string
			const error = e?.error || e?.message || String(e)
			res.status(status).send({ status, error })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
