import path from 'path'
import fs from 'fs'
import { run_R } from '@sjcrh/proteinpaint-r'
import serverconfig from '#src/serverconfig.js'
import type { GeneRankingRequest, GeneRankingResponse } from '#types'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'

export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: GeneRankingRequest = (req.method === 'POST' ? req.body : req.query) || ({} as any)
			if ((q as any).for === 'cluster') {
				await handleCluster(q, res)
			} else {
				await handleData(q, res, genomes)
			}
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e?.message || String(e) } satisfies GeneRankingResponse)
		}
	}
}

type ParsedFile = { columns: string[]; rows: (string | number | null)[][] }
type CacheEntry = { parsed: ParsedFile; mtimeMs: number }
const fileCache: Map<string, CacheEntry> = new Map()

function stripQuotes(s: string): string {
	if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1)
	return s
}

async function parseTsv(absPath: string): Promise<ParsedFile> {
	const text = await fs.promises.readFile(absPath, 'utf8')
	const lines = text.split(/\r?\n/).filter(l => l.length > 0)
	if (lines.length === 0) return { columns: [], rows: [] }
	const columns = lines[0].split('\t').map(stripQuotes)
	const rows: (string | number | null)[][] = []
	for (let i = 1; i < lines.length; i++) {
		const fields = lines[i].split('\t').map(stripQuotes)
		const normalizedFields =
			fields.length < columns.length
				? fields.concat(Array(columns.length - fields.length).fill(''))
				: fields.slice(0, columns.length)
		const row: (string | number | null)[] = normalizedFields.map(v => {
			if (v === '' || v === 'NA' || v === 'NaN') return null
			const n = Number(v)
			return Number.isFinite(n) && v.trim() !== '' ? n : v
		})
		rows.push(row)
	}
	return { columns, rows }
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

async function handleData(q: any, res, genomes): Promise<void> {
	const genome = genomes[q.genome]
	if (!genome) throw 'invalid genome'
	const ds = genome.datasets[q.dslabel]
	if (!ds) throw 'invalid dslabel'
	const cfg = ds.queries?.geneRanking as
		| { rankings: Record<string, string>; modalities?: string[]; description?: string }
		| undefined
	if (!cfg || !cfg.rankings) throw 'geneRanking not configured for this dataset'

	if (!q.key) {
		res.send({ keys: Object.keys(cfg.rankings) } satisfies GeneRankingResponse)
		return
	}

	const relPath = cfg.rankings[q.key]
	if (!relPath) throw 'invalid key'
	if (path.isAbsolute(relPath) || relPath.split(/[\\/]/).includes('..')) throw 'invalid file path'

	const absPath = path.resolve(serverconfig.tpmasterdir, relPath)
	const tpRoot = path.resolve(serverconfig.tpmasterdir) + path.sep
	if (!absPath.startsWith(tpRoot)) throw 'invalid file path'

	const stat = await fs.promises.stat(absPath)
	const cacheKey = `${q.genome}|${q.dslabel}|${q.key}`
	let entry = fileCache.get(cacheKey)
	if (!entry || entry.mtimeMs !== stat.mtimeMs) {
		entry = { parsed: await parseTsv(absPath), mtimeMs: stat.mtimeMs }
		fileCache.set(cacheKey, entry)
	}
	res.send({ columns: entry.parsed.columns, rows: entry.parsed.rows } satisfies GeneRankingResponse)
}

async function handleCluster(q: any, res): Promise<void> {
	const { row_names, col_names } = q
	if (!Array.isArray(q.matrix) || !Array.isArray(row_names) || !Array.isArray(col_names)) {
		throw 'matrix, row_names, and col_names are required'
	}
	if (q.matrix.length !== row_names.length) throw 'matrix.length must equal row_names.length'
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
		keptRows.push(row.map(v => (v === null || v === undefined || !Number.isFinite(v as number) ? null : (v as number))))
		keptNames.push(row_names[i])
	}
	if (keptRows.length < 3) throw `need at least 3 rows with ≥${minAssays} non-null values for clustering`

	// per-column z-score ignoring nulls (so missing cells don't bias the column mean/sd)
	const zMatrix = zscorePerColumnIgnoringNull(keptRows, col_names.length)

	// NA cells imputed to 0 (= column mean after z-score) so the R hclust.R pipeline stays intact.
	const matrixForR: number[][] = zMatrix.map(row => row.map(v => (v === null ? 0 : (v as number))))

	const clusterMethod = q.clusterMethod || 'average'
	const distanceMethod = q.distanceMethod || 'euclidean'
	if (!clusterMethodLst.find(i => i.value == clusterMethod)) throw 'Invalid cluster method'
	if (!distanceMethodLst.find(i => i.value == distanceMethod)) throw 'Invalid distance method'

	const inputData = {
		matrix: matrixForR,
		row_names: keptNames,
		col_names,
		cluster_method: clusterMethod,
		distance_method: distanceMethod,
		plot_image: false
	}

	const Routput = JSON.parse(await run_R('hclust.R', JSON.stringify(inputData)))

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
	} satisfies GeneRankingResponse)
}
