import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import { fingerprint } from '#src/routes/termdb.dmrBatch.ts'
import {
	admitDmrcateSampleTest,
	dmrcateDeadline,
	dmrcateValues,
	resolveMethylationMatrix,
	runDmrcate
} from '#src/utils/methylationMatrix.ts'
import { benjaminiHochberg, chrSeed, makeRng, normalTwoSidedP } from './dmrStats.ts'
import { buildGeneIndex, genesNear } from './dmrGenes.ts'
import { LINK_MAX_BP, MIN_EXPRESSION } from './dmrExpression.ts'

/* Which nearby gene a DMR's methylation tracks across patients.

Linking a DMR to the gene it overlaps or lies nearest is right for only about half of distal elements (Fulco 2019).
The cohort can say more: if a region regulates a gene, the patients whose region is more methylated should express
that gene differently. So each DMR's per-patient beta (its methylated over all reads, rust dmrcate sample_levels) is
correlated with the per-patient expression of every expressed gene within LINK_MAX_BP, and the DMR is linked to the
gene it correlates with best, when that holds at FDR < MAX_Q over every pair tested.

Within each group, not across the cohort: a gene that differs between the groups correlates with every region that
also differs, through the group label alone, which is the comparison already on the volcano. Both values are ranked
within their group and centered there, then correlated over the pooled patients: a stratified Spearman's rho.

What it cannot remove is anything that varies between patients within a group and moves methylation and expression
together everywhere: tumor purity, the share of other cell types, proliferation. So the same test is run on decoy
pairs -- for each DMR, as many expressed genes drawn from OTHER chromosomes as it had candidates -- and the share of
decoys passing the cis cutoff estimates how many cis links that background alone would produce (`trans`). */

/** pair-level FDR at or under which a DMR counts as linked */
export const MAX_Q = 0.05
/** Principal components of expression regressed out of both sides before correlating. Within-group ranks remove the
 * group difference but not what varies between patients everywhere -- tumor purity, cell mix, proliferation -- and
 * on MMRF t(4;14) without them decoy genes on other chromosomes passed the cis cutoff at 15.5% against 23% for cis
 * pairs, an FDR of ~67%. Removing the leading expression PCs is the usual remedy in methylation-expression (eQTM)
 * and eQTL mapping (e.g. GTEx regresses PEER factors / PCs). */
export const EXPRESSION_PCS = 10
/** Principal components of methylation regressed out too: expression PCs alone left decoys passing at 5.0% against
 * 18.6% cis, an FDR of ~27%, since a patient's global methylation level and purity move beta at every DMR. Estimated
 * per chromosome from up to METHYLATION_PC_DMRS of its DMRs, which a genome-wide axis reaches on every chromosome. */
export const METHYLATION_PCS = 10
const METHYLATION_PC_DMRS = 3000
/** Bump when a change here alters the links for an unchanged request. */
// 2: correlations are partial: both sides residualized on group and the leading EXPRESSION_PCS expression PCs
// 3: and on the leading METHYLATION_PCS methylation PCs of each chromosome's DMRs
const CACHE_VERSION = 3

export type DmrGeneCorrelation = {
	/** best pair per DMR keyed chr:start-stop; only DMRs with at least one expressed gene within reach */
	links: Record<string, { gene: string; distance: number; rho: number; p: number; q: number; n: number }>
	dmrs: number
	samples: [number, number]
	pairs: number
	significantPairs: number
	/** decoy pairs on other chromosomes, and how many pass the cis p cutoff; estFdr = their rate x cis pairs / cis
	 * significant pairs */
	trans: { pairs: number; belowCut: number; estFdr: number | null }
}

type Dmr = { chr: string; start: number; stop: number; no_cpgs: number }

export async function getDmrGeneCorrelations(arg: {
	genome: any
	ds: any
	/** the scan the DMRs come from, which fixes them */
	scanCacheId: string
	dmrs: Dmr[]
	/** methylation sample names, group 1 (control) and group 2 */
	group1: string[]
	group2: string[]
}): Promise<DmrGeneCorrelation> {
	const exprFile = arg.ds.queries?.geneExpression?.file
	if (typeof exprFile != 'string' || !exprFile.endsWith('.h5'))
		throw new Error('This dataset has no gene expression file to correlate methylation with.')
	const { result } = await cacheOrRecompute({
		computeArgument: {
			v: CACHE_VERSION,
			scan: arg.scanCacheId,
			group1: [...arg.group1].sort(),
			group2: [...arg.group2].sort(),
			linkMaxBp: LINK_MAX_BP,
			minExpression: MIN_EXPRESSION,
			files: fingerprint([exprFile, arg.genome?.genedb?.dbfile])
		},
		cacheSubdir: 'dmrGeneCorr',
		computeFresh: () => computeCorrelations(arg, exprFile)
	})
	return result as DmrGeneCorrelation
}

/** Rank scores within each group: rank (ties averaged) centered on the group's middle and scaled by its size, over the
 * values present; NaN stays NaN. `groupOf[i]` is sample i's group, 0 or 1. */
export function groupRankScores(v: ArrayLike<number>, groupOf: Uint8Array): Float64Array {
	const out = new Float64Array(v.length).fill(NaN)
	for (const g of [0, 1]) {
		const ix: number[] = []
		for (let i = 0; i < v.length; i++) if (groupOf[i] == g && Number.isFinite(v[i])) ix.push(i)
		ix.sort((a, b) => v[a] - v[b])
		const m = ix.length
		for (let a = 0; a < m; ) {
			let b = a
			while (b + 1 < m && v[ix[b + 1]] == v[ix[a]]) b++
			const rank = (a + b) / 2 + 1
			for (let k = a; k <= b; k++) out[ix[k]] = (rank - (m + 1) / 2) / m
			a = b + 1
		}
	}
	return out
}

/** Pearson correlation of two score vectors over the samples where both are present, and how many those are */
export function correlate(x: Float64Array, y: Float64Array): { r: number; n: number } {
	let n = 0
	let sx = 0
	let sy = 0
	let sxx = 0
	let syy = 0
	let sxy = 0
	for (let i = 0; i < x.length; i++) {
		const a = x[i]
		const b = y[i]
		if (a !== a || b !== b) continue // NaN
		n++
		sx += a
		sy += b
		sxx += a * a
		syy += b * b
		sxy += a * b
	}
	const vx = sxx - (sx * sx) / n
	const vy = syy - (sy * sy) / n
	return { r: vx > 0 && vy > 0 ? (sxy - (sx * sy) / n) / Math.sqrt(vx * vy) : NaN, n }
}

/** Two-sided p of a Spearman rho over n samples in 2 groups: Fisher's z with the Spearman variance 1.06/(n-3)
 * (Fieller 1957), one degree of freedom less for the second group's centering and one per further covariate */
export function rhoP(r: number, n: number, covariates = 0): number {
	const df = n - 4 - covariates
	if (!Number.isFinite(r) || df < 4) return NaN
	const c = Math.min(Math.abs(r), 0.999999)
	return normalTwoSidedP(Math.atanh(c) * Math.sqrt(df / 1.06))
}

/** Orthonormal basis of the given columns (Gram-Schmidt), dropping a column that adds nothing */
export function orthonormalize(cols: Float64Array[]): Float64Array[] {
	const out: Float64Array[] = []
	for (const c of cols) {
		const v = Float64Array.from(c)
		for (const q of out) {
			let d = 0
			for (let i = 0; i < v.length; i++) d += q[i] * v[i]
			for (let i = 0; i < v.length; i++) v[i] -= d * q[i]
		}
		let norm = 0
		for (let i = 0; i < v.length; i++) norm += v[i] * v[i]
		norm = Math.sqrt(norm)
		if (norm < 1e-8) continue
		for (let i = 0; i < v.length; i++) v[i] /= norm
		out.push(v)
	}
	return out
}

/** v less its projection on the orthonormal basis Q, with a missing value read as 0 (the scores are centered) and
 * left missing in the result */
export function residualize(v: Float64Array, Q: Float64Array[]): Float64Array {
	const r = new Float64Array(v.length)
	for (let i = 0; i < v.length; i++) r[i] = v[i] === v[i] ? v[i] : 0
	for (const q of Q) {
		let d = 0
		for (let i = 0; i < r.length; i++) d += q[i] * r[i]
		for (let i = 0; i < r.length; i++) r[i] -= d * q[i]
	}
	for (let i = 0; i < v.length; i++) if (v[i] !== v[i]) r[i] = NaN
	return r
}

/** The leading k principal components of the samples (columns) of `rows`, as k orthonormal sample vectors: subspace
 * iteration on the samples' Gram matrix, which is n x n however many rows there are. Missing values count as 0. */
export function samplePCs(rows: Float64Array[], n: number, k: number, iterations = 100): Float64Array[] {
	const G = new Float64Array(n * n)
	for (const x of rows)
		for (let i = 0; i < n; i++) {
			const xi = x[i] === x[i] ? x[i] : 0
			if (!xi) continue
			for (let j = i; j < n; j++) {
				const xj = x[j]
				if (xj === xj) G[i * n + j] += xi * xj
			}
		}
	for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) G[i * n + j] = G[j * n + i]
	const rnd = makeRng(1)
	let V = orthonormalize(Array.from({ length: k }, () => Float64Array.from({ length: n }, () => rnd() - 0.5)))
	for (let t = 0; t < iterations; t++) {
		V = orthonormalize(
			V.map(v => {
				const w = new Float64Array(n)
				for (let i = 0; i < n; i++) {
					let s = 0
					for (let j = 0; j < n; j++) s += G[i * n + j] * v[j]
					w[i] = s
				}
				return w
			})
		)
	}
	return V
}

async function computeCorrelations(arg: Parameters<typeof getDmrGeneCorrelations>[0], exprFile: string) {
	const t0 = Date.now()
	const { genome, ds } = arg
	const idx = buildGeneIndex(genome)
	if (!idx) throw new Error('This genome has no gene coordinates to find genes near a DMR.')

	// every expressed gene's per-patient values, for the samples of each group with expression
	const ex = JSON.parse(
		await run_python(
			'groupGeneMedians.py',
			JSON.stringify({ input_file: exprFile, groups: [arg.group1, arg.group2], values_min: MIN_EXPRESSION })
		)
	).values as { genes: string[]; samples: [string[], string[]]; data: [(number | null)[], (number | null)[]] }

	// the patients with both: group 1 then group 2, as the expression rows and the rust levels are reindexed below
	const methNames = new Set([...arg.group1, ...arg.group2])
	const patients: string[] = []
	const groupOf: number[] = []
	const exCol: [number, number][] = [] // (group, column in that group's expression rows)
	ex.samples.forEach((names, g) =>
		names.forEach((s, j) => {
			if (!methNames.has(s)) return
			patients.push(s)
			groupOf.push(g)
			exCol.push([g, j])
		})
	)
	const groupArr = Uint8Array.from(groupOf)
	const nPerGroup: [number, number] = [groupOf.filter(g => g == 0).length, groupOf.filter(g => g == 1).length]
	if (nPerGroup[0] < 10 || nPerGroup[1] < 5)
		throw new Error('Too few samples with both methylation and expression to correlate them.')

	// each expressed gene's rank scores over `patients`
	const exprScore = new Map<string, Float64Array>()
	const width = [ex.samples[0].length, ex.samples[1].length]
	ex.genes.forEach((gene, k) => {
		const v = new Float64Array(patients.length)
		exCol.forEach(([g, j], i) => {
			const x = ex.data[g][k * width[g] + j]
			v[i] = x == null ? NaN : x
		})
		exprScore.set(gene, groupRankScores(v, groupArr))
	})
	/* The covariates both sides are residualized on: each group's indicator, and the leading expression PCs of the
	within-group rank scores, which carry what varies between patients across the whole transcriptome. */
	const baseCovariates = [
		...[0, 1].map(g => Float64Array.from(groupArr, x => (x == g ? 1 : 0))),
		...samplePCs([...exprScore.values()], patients.length, EXPRESSION_PCS)
	]
	const covariates = EXPRESSION_PCS + METHYLATION_PCS
	// expressed genes by chromosome, for the decoys
	const geneChr = new Map<string, string>()
	for (const [chr, c] of idx)
		for (const name of c.name) if (exprScore.has(name) && !geneChr.has(name)) geneChr.set(name, chr)
	const decoyPool = [...geneChr.keys()]

	const byChr = new Map<string, Dmr[]>()
	for (const d of arg.dmrs) {
		const lst = byChr.get(d.chr)
		if (lst) lst.push(d)
		else byChr.set(d.chr, [d])
	}

	type Pair = { dmr: Dmr; gene: string; distance: number; r: number; n: number; p: number }
	const cis: Pair[] = []
	const decoyP: number[] = []
	for (const [chr, dmrs] of byChr) {
		const matrix = resolveMethylationMatrix(ds, chr, undefined)
		const release = await admitDmrcateSampleTest(
			[matrix.matrixFile],
			dmrs.length * patients.length,
			'Server memory is too low to correlate DMRs with expression right now. Try again later.'
		)
		let out: any
		try {
			out = JSON.parse(
				await runDmrcate(
					{
						matrices: [{ file: matrix.matrixFile, chrs: [chr] }],
						...dmrcateValues(matrix),
						background_regions: dmrs.map(d => ({ chr, start: d.start, stop: d.stop })),
						sample_test: true,
						sample_levels: true,
						min_reads: matrix.hasDepth ? 20 : 3,
						// only the patients with expression; the order rust returns them in is read back from `samples`
						case: patients.filter((_, i) => groupArr[i] == 1).join(','),
						control: patients.filter((_, i) => groupArr[i] == 0).join(',')
					},
					'Compare smaller groups.',
					dmrcateDeadline()
				)
			)
		} finally {
			release()
		}
		if (out.error) throw new Error(`${chr}: ${out.error}`)
		const ns = out.samples.length
		const colOf = new Map<string, number>((out.samples as string[]).map((s, i) => [s, i]))
		const col = patients.map(s => colOf.get(s)!)
		const rnd = makeRng(chrSeed(chr))
		const scores = dmrs.map((_, i) => {
			const lv = new Float64Array(patients.length)
			col.forEach((c, k) => {
				const v = out.levels[i * ns + c]
				lv[k] = v == null ? NaN : v
			})
			return groupRankScores(lv, groupArr)
		})
		// this chromosome's covariates: the shared ones and its methylation PCs, from an even sample of its DMRs
		const step = Math.max(1, Math.floor(scores.length / METHYLATION_PC_DMRS))
		const Q = orthonormalize([
			...baseCovariates,
			...samplePCs(
				scores.filter((_, i) => i % step == 0),
				patients.length,
				METHYLATION_PCS
			)
		])
		// genes residualized on this chromosome's covariates, as they are needed
		const exprRes = new Map<string, Float64Array>()
		const expr = (gene: string) => {
			let v = exprRes.get(gene)
			if (!v) exprRes.set(gene, (v = residualize(exprScore.get(gene)!, Q)))
			return v
		}
		dmrs.forEach((d, i) => {
			const near = genesNear(idx, chr, d.start, d.stop, LINK_MAX_BP).filter(g => exprScore.has(g.name))
			if (!near.length) return
			const ms = residualize(scores[i], Q)
			for (const g of near) {
				const { r, n } = correlate(ms, expr(g.name))
				const p = rhoP(r, n, covariates)
				if (Number.isFinite(p)) cis.push({ dmr: d, gene: g.name, distance: g.distance, r, n, p })
			}
			// as many decoys as candidates, from other chromosomes
			for (let k = 0; k < near.length; k++) {
				let gene = decoyPool[Math.floor(rnd() * decoyPool.length)]
				for (let t = 0; t < 20 && geneChr.get(gene) == chr; t++) gene = decoyPool[Math.floor(rnd() * decoyPool.length)]
				const { r, n } = correlate(ms, expr(gene))
				const p = rhoP(r, n, covariates)
				if (Number.isFinite(p)) decoyP.push(p)
			}
		})
	}

	const q = benjaminiHochberg(cis.map(c => c.p))
	let pCut = 0
	let significantPairs = 0
	cis.forEach((c, i) => {
		if (q[i] <= MAX_Q) {
			significantPairs++
			if (c.p > pCut) pCut = c.p
		}
	})
	const links: DmrGeneCorrelation['links'] = {}
	cis.forEach((c, i) => {
		const key = `${c.dmr.chr}:${c.dmr.start}-${c.dmr.stop}`
		const prev = links[key]
		if (!prev || c.p < prev.p)
			links[key] = { gene: c.gene, distance: c.distance, rho: round(c.r), p: c.p, q: q[i], n: c.n }
	})
	const belowCut = significantPairs ? decoyP.filter(p => p <= pCut).length : 0
	const result: DmrGeneCorrelation = {
		links,
		dmrs: arg.dmrs.length,
		samples: nPerGroup,
		pairs: cis.length,
		significantPairs,
		trans: {
			pairs: decoyP.length,
			belowCut,
			estFdr: significantPairs && decoyP.length ? (belowCut / decoyP.length) * (cis.length / significantPairs) : null
		}
	}
	mayLog(
		`dmrGeneCorr: ${arg.dmrs.length} DMRs, ${cis.length} pairs, ${significantPairs} at q<=${MAX_Q},`,
		formatElapsedTime(Date.now() - t0)
	)
	return result
}

function round(v: number) {
	return Math.round(v * 10000) / 10000
}
