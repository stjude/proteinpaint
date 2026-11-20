/* Pathway enrichment over evidence merged from several omics layers, with an expected direction between them.

Two steps, as published for directional P-value merging (DPM; Slobodyanyuk et al. 2024 Nat Commun 15:5779) and
ranked-hypergeometric pathway enrichment (ActivePathways; Paczkowska et al. 2020 Nat Commun 11:735):

1. mergeDirectionalP: per gene, one p from several layers' p-values (e.g. differential expression and differential
   methylation). Each layer adds -2 ln p (Fisher), signed by whether its observed direction agrees with the layer's
   constraint: with constraints [+1, +1] a gene up in both layers, or down in both, adds up; up in one and down in the
   other cancels. Layers with constraint 0 add unsigned. The statistic is tested against a chi-square scaled for the
   dependence between layers by Brown's method (Brown 1975 Biometrics 31:987), the covariances estimated from the
   genes themselves (the empirical Brown's method, Poole et al. 2016 Bioinformatics 32:i430).
2. pathwayEnrichment: genes ordered by merged p (those at or below a cutoff), each gene set tested by the smallest
   hypergeometric tail over the list's prefixes that end at a set member, then Benjamini-Hochberg across sets.
3. layeredPathways: step 2 on each layer alone and on the merged p-values, for a side-by-side view.

Everything is kept on the log scale: merged p-values reach far below 1e-300, and ordering genes by them must not
collapse them to ties at 0. No dependencies. */

const LN_P_FLOOR = Math.log(1e-300) // a layer's p below this counts as 1e-300, so -2 ln p stays finite

/* ---- distributions ---- */

// Lanczos approximation, g = 7, n = 9 (relative error < 1e-15 for positive arguments)
const LANCZOS = [
	0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
	12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
]

export function logGamma(x: number): number {
	if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x)
	x -= 1
	let a = LANCZOS[0]
	const t = x + 7.5
	for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i)
	return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** ln Q(a, x), the regularized upper incomplete gamma function: a power series below a + 1, a continued fraction
 * (modified Lentz) above it, where Q is small and its log must not underflow. */
export function logGammaQ(a: number, x: number): number {
	if (!(x > 0)) return 0
	const lead = -x + a * Math.log(x) - logGamma(a)
	if (x < a + 1) {
		let term = 1 / a
		let sum = term
		for (let n = 1; n < 10000; n++) {
			term *= x / (a + n)
			sum += term
			if (Math.abs(term) < Math.abs(sum) * 1e-16) break
		}
		return Math.log1p(-Math.min(1, Math.exp(lead) * sum))
	}
	const tiny = 1e-300
	let b = x + 1 - a
	let c = 1 / tiny
	let d = 1 / b
	let h = d
	for (let i = 1; i < 10000; i++) {
		const an = -i * (i - a)
		b += 2
		d = an * d + b
		if (Math.abs(d) < tiny) d = tiny
		c = b + an / c
		if (Math.abs(c) < tiny) c = tiny
		d = 1 / d
		const del = d * c
		h *= del
		if (Math.abs(del - 1) < 1e-16) break
	}
	return lead + Math.log(h)
}

/** ln P(X > x) for X ~ chi-square with df degrees of freedom (df need not be an integer) */
export function chiSquareLogSf(x: number, df: number): number {
	return logGammaQ(df / 2, x / 2)
}

const logChoose = (n: number, k: number) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1)

/** ln P(X >= x) for X, the number of marked items among `draws` drawn without replacement from `population` items
 * of which `marked` are marked */
export function hypergeometricLogSf(x: number, population: number, marked: number, draws: number): number {
	const lo = Math.max(0, draws - (population - marked))
	const hi = Math.min(marked, draws)
	if (x <= lo) return 0
	if (x > hi) return -Infinity
	// ln P(X = x), then each next term by the ratio of consecutive probabilities: one log a term, not nine log-gammas
	const terms = [logChoose(marked, x) + logChoose(population - marked, draws - x) - logChoose(population, draws)]
	for (let k = x; k < hi; k++)
		terms.push(
			terms[terms.length - 1] +
				Math.log(((marked - k) * (draws - k)) / ((k + 1) * (population - marked - draws + k + 1)))
		)
	const m = Math.max(...terms)
	return Math.min(0, m + Math.log(terms.reduce((s, t) => s + Math.exp(t - m), 0)))
}

/* ---- merging ---- */

/** Brown's correction for p-values merged across dependent layers. Each layer's p-values are mapped through their own
 * empirical CDF to -2 ln F(p); the covariances of those, over genes, set the scale and degrees of freedom of the
 * chi-square that the Fisher-type statistic is compared with. Independent layers give df = 2k and scale 1. */
export function brownCorrection(logP: number[][]): { df: number; scale: number } {
	const k = logP[0]?.length || 0
	const n = logP.length
	const transformed: number[][] = []
	for (let j = 0; j < k; j++) {
		const col = logP.map(r => r[j])
		const sorted = [...col].sort((a, b) => a - b)
		if (sorted[0] == sorted[n - 1]) {
			transformed.push(col.map(() => 0)) // a constant layer has no covariance with anything
			continue
		}
		// F(p) = share of genes at or below p, so the largest p maps to 0 and the smallest to 2 ln n
		const upper = (v: number) => {
			let lo = 0
			let hi = n
			while (lo < hi) {
				const mid = (lo + hi) >> 1
				if (sorted[mid] <= v) lo = mid + 1
				else hi = mid
			}
			return lo
		}
		transformed.push(col.map(v => -2 * Math.log(upper(v) / n)))
	}
	const mean = transformed.map(t => t.reduce((s, v) => s + v, 0) / n)
	let covSum = 0
	for (let a = 0; a < k; a++)
		for (let b = a + 1; b < k; b++) {
			let s = 0
			for (let i = 0; i < n; i++) s += (transformed[a][i] - mean[a]) * (transformed[b][i] - mean[b])
			covSum += (2 * s) / (n - 1)
		}
	const variance = 4 * k + covSum
	let df = (8 * k * k) / variance
	let scale = variance / (4 * k)
	// positively dependent layers lower df below 2k; negative covariance cannot raise it above
	if (df > 2 * k) {
		df = 2 * k
		scale = 1
	}
	return { df, scale }
}

/** Merged p per gene (as ln p). p[i][j] is gene i's p-value in layer j, direction[i][j] its sign of change (0 when the
 * layer has none), constraints[j] +1/-1 for the direction expected relative to the other layers, 0 for none. */
export function mergeDirectionalP(p: number[][], direction: number[][], constraints: number[]): number[] {
	const logP = p.map(row => row.map(v => Math.max(Math.log(v), LN_P_FLOOR)))
	const { df, scale } = brownCorrection(logP)
	return logP.map((row, i) => {
		let signed = 0
		let unsigned = 0
		row.forEach((lp, j) => {
			const s = constraints[j] * Math.sign(direction[i][j])
			if (s) signed += -2 * lp * s
			else unsigned += -2 * lp
		})
		return chiSquareLogSf((Math.abs(signed) + unsigned) / scale, df)
	})
}

/* ---- enrichment ---- */

/** The best prefix of `ordered` for one gene set: the smallest hypergeometric tail among the prefixes that end at a
 * set member (only those can lower it), and the members in that prefix. Ties keep the longer prefix. */
export function rankedHypergeometric(
	ordered: string[],
	background: number,
	set: Set<string>,
	/** each gene's index in `ordered`, when testing many sets against one list */
	rankOf: Map<string, number> = new Map(ordered.map((g, i) => [g, i]))
): { logP: number; overlap: string[] } {
	// the members' places in the list, so a set costs its own size, not the list's length
	const at: number[] = []
	for (const g of set) {
		const i = rankOf.get(g)
		if (i != undefined) at.push(i)
	}
	at.sort((a, b) => a - b)
	let best = { logP: 0, hits: 0 }
	at.forEach((i, h) => {
		const lp = hypergeometricLogSf(h + 1, background, i + 1, set.size)
		if (lp <= best.logP) best = { logP: lp, hits: h + 1 }
	})
	return { logP: best.logP, overlap: at.slice(0, best.hits).map(i => ordered[i]) }
}

/** Benjamini-Hochberg on log p-values; returns ln q */
export function logBH(logP: number[]): number[] {
	const m = logP.length
	const order = logP.map((_, i) => i).sort((a, b) => logP[b] - logP[a])
	const q = new Array(m)
	let running = 0
	order.forEach((idx, r) => {
		running = Math.min(running, logP[idx] + Math.log(m / (m - r)))
		q[idx] = running
	})
	return q
}

export type PathwayResult = { id: string; size: number; logP: number; logQ: number; overlap: string[] }

/** Each gene set's ranked-hypergeometric enrichment in the genes ordered by ln p, among those at or below the cutoff.
 * Sets are cut to the background first and kept when their size there is within sizeRange. */
export function pathwayEnrichment(opts: {
	genes: string[]
	logP: number[]
	background: Iterable<string>
	sets: Record<string, Iterable<string>>
	cutoff?: number
	sizeRange?: [number, number]
}): PathwayResult[] {
	const bg = new Set(opts.background)
	const cut = Math.log(opts.cutoff ?? 0.1)
	const [minSize, maxSize] = opts.sizeRange ?? [10, 500]
	const ordered = opts.genes
		.map((g, i) => ({ g, lp: opts.logP[i] }))
		.filter(x => bg.has(x.g) && x.lp <= cut)
		.sort((a, b) => a.lp - b.lp)
		.map(x => x.g)
	const rankOf = new Map(ordered.map((g, i) => [g, i]))
	const out: PathwayResult[] = []
	for (const [id, genes] of Object.entries(opts.sets)) {
		const set = new Set([...genes].filter(g => bg.has(g)))
		if (set.size < minSize || set.size > maxSize) continue
		const r = rankedHypergeometric(ordered, bg.size, set, rankOf)
		out.push({ id, size: set.size, logP: r.logP, logQ: 0, overlap: r.overlap })
	}
	const q = logBH(out.map(r => r.logP))
	out.forEach((r, i) => (r.logQ = q[i]))
	return out
}

export type LayerEnrichment = {
	/** log10 of the set's Benjamini-Hochberg q */
	log10q: number
	/** whether the genes the test picked mostly went up (1) or down (-1), by their own layer's direction; the merged
	 * layer goes by the first layer's */
	direction: number
	/** genes in the set's best prefix */
	overlap: number
}

/** Each gene set's enrichment from every layer alone and from the layers merged (last), on the same genes and sets,
 * for a view that sets them side by side as Köhnke et al. 2026 drew ActivePathways' results. Arguments as
 * mergeDirectionalP and pathwayEnrichment; the background is the genes given. */
export function layeredPathways(opts: {
	genes: string[]
	p: number[][]
	direction: number[][]
	constraints: number[]
	sets: Record<string, Iterable<string>>
	cutoff?: number
	sizeRange?: [number, number]
}) {
	const k = opts.constraints.length
	const cut = Math.log(opts.cutoff ?? 0.1)
	const logP = opts.p.map(row => row.map(v => Math.max(Math.log(v), LN_P_FLOOR)))
	const columns = Array.from({ length: k }, (_, j) => logP.map(r => r[j]))
	columns.push(mergeDirectionalP(opts.p, opts.direction, opts.constraints))
	// the same sets in the same order from every column: same genes, background and size filter
	const results = columns.map(logP =>
		pathwayEnrichment({
			genes: opts.genes,
			logP,
			background: opts.genes,
			sets: opts.sets,
			cutoff: opts.cutoff,
			sizeRange: opts.sizeRange
		})
	)
	const row = new Map(opts.genes.map((g, i) => [g, i]))
	const sets = results[0].map((first, s) => ({
		id: first.id,
		size: first.size,
		layers: results.map((res, j): LayerEnrichment => {
			const r = res[s]
			const layer = j < k ? j : 0
			const sum = r.overlap.reduce((a, g) => a + Math.sign(opts.direction[row.get(g)!][layer]), 0)
			return { log10q: r.logQ / Math.LN10, direction: Math.sign(sum), overlap: r.overlap.length }
		}),
		/** the merged layer's picked genes, most significant first */
		genes: results[k][s].overlap
	}))
	return {
		brown: brownCorrection(logP),
		/** genes at or below the cutoff, per layer and merged */
		passing: columns.map(c => c.filter(lp => lp <= cut).length),
		sets
	}
}
