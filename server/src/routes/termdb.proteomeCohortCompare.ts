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
Returns the aligned z matrix plus pairwise Pearson (on z) and Spearman (on ranks) correlations,
and a clustered heatmap, a shared-vs-specific DAP overlap (UpSet), and an
age/progression trajectory (per-series k-means clusters of protein trajectories).
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

type OverlapCombo = { cohorts: number[]; genes: string[] }

/** Shared-vs-specific DAP set overlaps (UpSet), computed per direction.
 *  A gene is a DAP in cohort c when |z| ≥ zThresh AND FDR ≤ fdrThresh, split by sign.
 *  Genes are grouped by exactly which cohorts they are a DAP in (the union of DAPs, not the
 *  shared axis), so single-cohort combinations are the cohort-specific proteins. */
function buildOverlap(maps: Map<string, GeneStat>[], zThresh: number, fdrThresh: number) {
	const buildDir = (up: boolean): OverlapCombo[] => {
		// geneKey -> ascending list of cohort indices where it is a DAP in this direction
		const membership = new Map<string, number[]>()
		for (let c = 0; c < maps.length; c++) {
			for (const [gene, s] of maps[c]) {
				if (Math.abs(s.z) < zThresh || s.p > fdrThresh) continue
				if (up ? s.z <= 0 : s.z >= 0) continue
				let arr = membership.get(gene)
				if (!arr) membership.set(gene, (arr = []))
				arr.push(c) // c ascends, so arr stays sorted
			}
		}
		// group genes by their exact membership combination
		const combos = new Map<string, string[]>()
		for (const [gene, arr] of membership) {
			const key = arr.join(',')
			let g = combos.get(key)
			if (!g) combos.set(key, (g = []))
			g.push(gene)
		}
		return [...combos.entries()]
			.map(([key, genes]) => ({ cohorts: key.split(',').map(Number), genes: genes.sort() }))
			.sort((a, b) => b.genes.length - a.genes.length)
	}
	return { up: buildDir(true), down: buildDir(false) }
}

type TrajectoryConfig = { series: string; value: number; label: string }

/** deterministic PRNG (mulberry32) so identical requests cluster identically */
function mulberry32(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function dist2(a: number[], b: number[]): number {
	let s = 0
	for (let i = 0; i < a.length; i++) {
		const d = a[i] - b[i]
		s += d * d
	}
	return s
}

/** standardize a trajectory (mean 0, SD 1) so clustering keys on SHAPE, not amplitude/offset */
function standardizeVec(v: number[]): number[] {
	const mu = v.reduce((a, b) => a + b, 0) / v.length
	const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length)
	if (sd < 1e-9) return v.map(() => 0)
	return v.map(x => (x - mu) / sd)
}

/** module eigengene = first principal component (over timepoints) of the cluster's standardized
 *  trajectories — the representative trend line (as in WGCNA). `rows` are the members' standardized
 *  trajectories (each length T). Returns a length-T vector, signed to match the average trend and
 *  standardized for display on the same relative-abundance scale as the member lines. */
function computeEigengene(rows: number[][]): number[] {
	const T = rows[0].length
	// gram matrix over timepoints: G[i][j] = Σ_protein shape[i]·shape[j]  (T×T)
	const G = Array.from({ length: T }, () => new Array(T).fill(0))
	for (const r of rows) for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) G[i][j] += r[i] * r[j]
	// each row is mean-centered, so the uniform vector is G's null direction — initialize power
	// iteration from the average trajectory (in the row space) instead, falling back to a ramp
	const mean = new Array(T).fill(0)
	for (const r of rows) for (let i = 0; i < T; i++) mean[i] += r[i] / rows.length
	let e = mean.slice()
	let en = Math.sqrt(e.reduce((a, b) => a + b * b, 0))
	if (en < 1e-9) {
		e = Array.from({ length: T }, (_, i) => i - (T - 1) / 2)
		en = Math.sqrt(e.reduce((a, b) => a + b * b, 0))
	}
	e = e.map(v => v / en)
	for (let it = 0; it < 100; it++) {
		const y = new Array(T).fill(0)
		for (let i = 0; i < T; i++) {
			let s = 0
			for (let j = 0; j < T; j++) s += G[i][j] * e[j]
			y[i] = s
		}
		const norm = Math.sqrt(y.reduce((a, b) => a + b * b, 0))
		if (norm < 1e-12) break
		const ny = y.map(v => v / norm)
		let diff = 0
		for (let i = 0; i < T; i++) diff += Math.abs(ny[i] - e[i])
		e = ny
		if (diff < 1e-9) break
	}
	// sign so the eigengene points the same way as the members' average trajectory
	let dot = 0
	for (let i = 0; i < T; i++) dot += e[i] * mean[i]
	if (dot < 0) e = e.map(v => -v)
	return standardizeVec(e)
}

/** k-means (k-means++ init, Lloyd iterations), seeded for reproducibility */
function kmeans(data: number[][], K: number): number[] {
	const n = data.length
	const dim = data[0].length
	const rng = mulberry32(42)
	const centroids: number[][] = [data[Math.floor(rng() * n)].slice()]
	const d2 = new Array(n).fill(Infinity)
	while (centroids.length < K) {
		let sum = 0
		const last = centroids[centroids.length - 1]
		for (let i = 0; i < n; i++) {
			const dd = dist2(data[i], last)
			if (dd < d2[i]) d2[i] = dd
			sum += d2[i]
		}
		let r = rng() * sum,
			pick = n - 1
		for (let i = 0; i < n; i++) {
			r -= d2[i]
			if (r <= 0) {
				pick = i
				break
			}
		}
		centroids.push(data[pick].slice())
	}
	const assign = new Array(n).fill(0)
	for (let iter = 0; iter < 40; iter++) {
		let changed = false
		for (let i = 0; i < n; i++) {
			let best = 0,
				bd = Infinity
			for (let c = 0; c < K; c++) {
				const dd = dist2(data[i], centroids[c])
				if (dd < bd) {
					bd = dd
					best = c
				}
			}
			if (assign[i] !== best) {
				assign[i] = best
				changed = true
			}
		}
		const sums = Array.from({ length: K }, () => new Array(dim).fill(0))
		const counts = new Array(K).fill(0)
		for (let i = 0; i < n; i++) {
			counts[assign[i]]++
			const s = sums[assign[i]]
			for (let d = 0; d < dim; d++) s[d] += data[i][d]
		}
		for (let c = 0; c < K; c++) {
			if (!counts[c]) continue // leave an empty cluster's centroid in place
			for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c]
		}
		if (!changed && iter > 0) break
	}
	return assign
}

/** human-readable series name from the shared catalog identity of its cohorts */
function seriesLabel(cat: Record<string, string> | null, fallback: string): string {
	if (!cat) return fallback
	const parts = [cat.model, cat.cellType, cat.brainRegion].filter(Boolean)
	return parts.length ? parts.join(' · ') : fallback
}

/** Age/progression trajectory. Groups the selected cohorts into ordered series (≥3 distinct
 *  timepoints; replicate cohorts sharing an age are averaged), then within each series clusters the
 *  variable proteins (DAP in ≥1 cohort, measured in all; flat proteins dropped) by trajectory SHAPE
 *  (k-means). Returns per-series clusters: the module eigengene trend line, member gene lists, and a
 *  capped sample of individual trajectories for the overlay. */
function buildTrajectory(
	cohorts: CohortRef[],
	trajOf: (TrajectoryConfig | null)[],
	catalogOf: (Record<string, string> | null)[],
	maps: Map<string, GeneStat>[],
	zThresh: number,
	fdrThresh: number,
	nClusters: number
) {
	// group cohort indices by series id
	const bySeries = new Map<string, number[]>()
	trajOf.forEach((t, i) => {
		if (!t) return
		let arr = bySeries.get(t.series)
		if (!arr) bySeries.set(t.series, (arr = []))
		arr.push(i)
	})

	const LINE_CAP = 150 // max individual trajectories returned per cluster (for the overlay)
	const out: any[] = []
	for (const [series, idxs] of bySeries) {
		// distinct ordered timepoints; any replicate cohorts sharing an age are averaged
		const byValue = new Map<number, number[]>()
		for (const i of idxs) {
			const v = trajOf[i]!.value
			const arr = byValue.get(v)
			if (arr) arr.push(i)
			else byValue.set(v, [i])
		}
		const values = [...byValue.keys()].sort((a, b) => a - b)
		if (values.length < 3) continue // a trajectory needs ≥3 distinct timepoints
		const points = values.map(v => ({ value: v, label: trajOf[byValue.get(v)![0]]!.label }))
		const seriesMaps = idxs.map(i => maps[i])
		const label = seriesLabel(catalogOf[idxs[0]], cohorts[idxs[0]].cohort)

		// proteins measured in EVERY cohort of the series
		let genes = [...seriesMaps[0].keys()]
		for (let k = 1; k < seriesMaps.length; k++) {
			const m = seriesMaps[k]
			genes = genes.filter(g => m.has(g))
		}
		// keep only variable proteins: a DAP in ≥1 cohort
		genes = genes.filter(g =>
			seriesMaps.some(m => {
				const s = m.get(g)!
				return Math.abs(s.z) >= zThresh && s.p <= fdrThresh
			})
		)
		genes.sort()

		// z per distinct timepoint (average of any replicate cohorts at that age)
		const zAt = (g: string, v: number) => {
			const is = byValue.get(v)!
			let s = 0
			for (const i of is) s += maps[i].get(g)!.z
			return s / is.length
		}
		// standardized trajectory (shape = "relative abundance") per gene; drop proteins that are flat
		// across timepoints (no temporal shape to cluster or plot, and they'd distort the eigengene)
		const keptGenes: string[] = []
		const shape: number[][] = []
		for (const g of genes) {
			const sh = standardizeVec(values.map(v => zAt(g, v)))
			if (sh.every(x => x === 0)) continue
			keptGenes.push(g)
			shape.push(sh)
		}

		const k = Math.min(nClusters, keptGenes.length)
		if (k < 1) {
			out.push({ series, label, points, clusters: [], geneCount: 0 })
			continue
		}
		const assign = kmeans(shape, k)

		const clusters: any[] = []
		for (let c = 0; c < k; c++) {
			const memberIdx: number[] = []
			for (let i = 0; i < keptGenes.length; i++) if (assign[i] === c) memberIdx.push(i)
			if (!memberIdx.length) continue
			const memberShapes = memberIdx.map(i => shape[i])
			clusters.push({
				size: memberIdx.length,
				genes: memberIdx.map(i => keptGenes[i]),
				// standardized member trajectories (a capped sample for the faint individual lines)
				lines: memberShapes.slice(0, LINE_CAP),
				// module eigengene: PC1 of the members' standardized trajectories — the thick trend line
				eigengene: computeEigengene(memberShapes)
			})
		}
		clusters.sort((a, b) => b.size - a.size)
		out.push({ series, label, points, clusters, geneCount: keptGenes.length })
	}
	return out
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

			// load + standardize each cohort; capture each cohort's trajectory config (authoritative
			// age/progression ordering from the dataset) alongside for the trajectory view
			const maps: (Map<string, GeneStat> | null)[] = []
			const trajOf: (TrajectoryConfig | null)[] = []
			const catalogOf: (Record<string, string> | null)[] = []
			for (const c of cohorts) {
				const cc = organisms[c.organism]?.assays?.[c.assay]?.cohorts?.[c.cohort]
				if (!cc?.DAPfile) throw `no DAPfile for ${c.organism}/${c.assay}/${c.cohort}`
				maps.push(await loadCohortZ(path.join(serverconfig.tpmasterdir, cc.DAPfile), crossSpecies))
				trajOf.push(cc.trajectory || null)
				catalogOf.push(cc.catalog || null)
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

			// DAP cutoffs, shared by the heatmap and overlap views.
			// finite-check (not `||`) so a user-supplied 0 (e.g. |z| ≥ 0) isn't swallowed by the default
			const num = (v: any, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def)
			const zThresh = num(q.zThresh, 2)
			const fdrThresh = num(q.fdrThresh, 0.05)

			// optional protein × cohort clustered heatmap (rows = DAP-union, both axes clustered)
			let heatmap: any = undefined
			if (q.heatmap === true || q.heatmap === 'true') {
				const maxRows = num(q.maxRows, 30)
				const cohortLabels = cohorts.map(c => c.label || c.cohort)
				heatmap = await buildHeatmap(cohortLabels, shared, z, fc, p, zThresh, fdrThresh, maxRows)
			}

			// optional shared-vs-specific DAP overlap (UpSet), split by direction
			let overlap: any = undefined
			if (q.overlap === true || q.overlap === 'true') {
				overlap = buildOverlap(maps as Map<string, GeneStat>[], zThresh, fdrThresh)
			}

			// optional age/progression trajectory: cluster proteins by shape (k-means) per series
			let trajectory: any = undefined
			if (q.trajectory === true || q.trajectory === 'true') {
				const nClusters = Math.max(1, num(q.nClusters, 3)) // guard against a direct call with 0/negative
				trajectory = buildTrajectory(
					cohorts,
					trajOf,
					catalogOf,
					maps as Map<string, GeneStat>[],
					zThresh,
					fdrThresh,
					nClusters
				)
			}

			res.send({
				// attach each cohort's trajectory config so the client can offer the trajectory view
				cohorts: cohorts.map((c, i) => ({ ...c, geneCount: maps[i]!.size, trajectory: trajOf[i] })),
				crossSpecies,
				genes: shared,
				sharedGeneCount: shared.length,
				z,
				fc,
				p,
				pearson: pearsonM,
				spearman: spearmanM,
				heatmap,
				overlap,
				trajectory
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
