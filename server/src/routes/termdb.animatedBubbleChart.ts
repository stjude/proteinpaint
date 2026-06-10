import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import type { AnimatedBubbleChartRequest, AnimatedBubble, AssaySlice } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import serverconfig from '#src/serverconfig.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'AnimatedBubbleChartRequest' },
	response: { typeId: 'AnimatedBubbleChartResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/animatedBubbleChart',
	methods: {
		get: payload,
		post: payload
	}
}

// Small mtime-invalidated cache of parsed ranking-file lines, so repeated requests
// for the same file (e.g. toggling modes, re-fetching) skip the disk read + split.
const lineCache = new Map<string, { mtimeMs: number; lines: string[] }>()
async function readRankingLines(filePath: string): Promise<string[]> {
	const stat = await fs.stat(filePath)
	const cached = lineCache.get(filePath)
	if (cached && cached.mtimeMs === stat.mtimeMs) return cached.lines
	const content = await fs.readFile(filePath, 'utf8')
	const lines = content.split('\n').filter(l => l.length > 0)
	lineCache.set(filePath, { mtimeMs: stat.mtimeMs, lines })
	return lines
}

function stripQuotes(s: string): string {
	const t = s.trim()
	if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
	return t
}

function parseNum(s: string | undefined): number | null {
	if (s == null) return null
	const t = stripQuotes(s)
	if (t === '' || t === 'NA' || t === 'NaN') return null
	const n = Number(t)
	return Number.isFinite(n) ? n : null
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: AnimatedBubbleChartRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const grConfig = ds.queries?.geneRanking
			if (!grConfig?.rankings) throw 'queries.geneRanking.rankings not configured for this dataset'
			if (!grConfig.modalities?.length) throw 'queries.geneRanking.modalities not configured'

			const rankingKeys = Object.keys(grConfig.rankings)
			if (rankingKeys.length === 0) throw 'no rankings configured'

			const selectedKey = q.rankingKey && rankingKeys.includes(q.rankingKey) ? q.rankingKey : rankingKeys[0]
			const filePath = path.join(serverconfig.tpmasterdir, grConfig.rankings[selectedKey])
			const lines = await readRankingLines(filePath)
			if (lines.length < 2) throw `geneRanking file '${selectedKey}' is empty or header-only`

			// Parse header
			const header = lines[0].split('\t').map(stripQuotes)
			const geneIdx = header.indexOf('Gene')
			if (geneIdx < 0) throw 'header missing "Gene" column'
			const integrativeRankIdx = header.indexOf('Integrative rank')
			if (integrativeRankIdx < 0) throw 'header missing "Integrative rank" column'
			const orderQIdx = header.indexOf('Order statistic Q')
			const pValueIdx = header.indexOf('P value')
			const fdrIdx = header.indexOf('FDR')

			// Modalities (assay names) come from dataset config. A given ranking file may
			// not include every configured modality (e.g. FTLD has fewer assays than AD) —
			// skip missing ones rather than erroring, preserving the config's display order.
			const assays: string[] = []
			const assayIdxs: number[] = []
			for (const m of grConfig.modalities) {
				const i = header.indexOf(m)
				if (i < 0) continue
				assays.push(m)
				assayIdxs.push(i)
			}
			if (assays.length === 0) throw `none of the configured modalities found in ${selectedKey}`

			// Parse rows
			type Row = {
				gene: string
				integrativeRank: number
				orderQ: number | null
				pValue: number | null
				fdr: number | null
				assayRanks: (number | null)[]
			}
			const rows: Row[] = []
			const maxRankPerAssay: number[] = new Array(assays.length).fill(0)

			for (let li = 1; li < lines.length; li++) {
				const parts = lines[li].split('\t')
				const gene = stripQuotes(parts[geneIdx] ?? '')
				if (!gene) continue
				const iRank = parseNum(parts[integrativeRankIdx])
				if (iRank == null) continue

				const assayRanks: (number | null)[] = []
				for (let ai = 0; ai < assayIdxs.length; ai++) {
					const v = parseNum(parts[assayIdxs[ai]])
					assayRanks.push(v)
					if (v != null && v > maxRankPerAssay[ai]) maxRankPerAssay[ai] = v
				}

				rows.push({
					gene,
					integrativeRank: iRank,
					orderQ: orderQIdx >= 0 ? parseNum(parts[orderQIdx]) : null,
					pValue: pValueIdx >= 0 ? parseNum(parts[pValueIdx]) : null,
					fdr: fdrIdx >= 0 ? parseNum(parts[fdrIdx]) : null,
					assayRanks
				})
			}
			if (rows.length === 0) throw `no data rows parsed from geneRanking file '${selectedKey}'`

			const topN = 100 // number of top-ranked genes to display
			rows.sort((a, b) => a.integrativeRank - b.integrativeRank)
			const top = rows.slice(0, topN)

			const bubbles: AnimatedBubble[] = top.map(r => {
				// Weight = log(N/rank), normalized so top rank → 1 and worst rank (=N) → 0.
				// Using a log curve makes hero ranks (1-3) clearly dominate the slice without
				// collapsing all "near-the-top" ranks into the same visual share, which the
				// linear (N − rank + 1)/N percentile would do.
				const weights: (number | null)[] = r.assayRanks.map((rank, ai) => {
					if (rank == null || rank <= 0) return null
					const N = maxRankPerAssay[ai]
					if (N <= 1) return null
					return Math.log(N / rank) / Math.log(N)
				})
				const sum = weights.reduce((s: number, w) => s + (w ?? 0), 0)
				const slices: AssaySlice[] = assays.map((name, ai) => {
					const w = weights[ai]
					const angle = w != null && sum > 0 ? (w / sum) * 2 * Math.PI : 0
					// `weight` is the normalized log-weight (0..1) = this modality's share of the ring
					return { assay: name, rank: r.assayRanks[ai], weight: w, angle }
				})
				return {
					gene: r.gene,
					integrativeRank: r.integrativeRank,
					orderStatQ: r.orderQ,
					pValue: r.pValue,
					fdr: r.fdr,
					slices
				}
			})

			res.send({
				bubbles,
				assays,
				rankingKeys,
				selectedRankingKey: selectedKey
			})
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
