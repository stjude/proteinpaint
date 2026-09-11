/* Do the genes losing gene-body methylation also lose expression?

Gene-body methylation tracks transcription -- it is why the ACTIVE X carries gene-body methylation
and the inactive one does not (Hellman & Chess 2007). So a scan finding methylation loss
concentrated in gene bodies makes a directional, falsifiable prediction: those genes should be
expressed lower in the same patients. That is the first step in this analysis that connects
methylation to function rather than to another methylation-adjacent annotation.

The comparison MUST be length-controlled. A long gene collects more DMRs simply by being long --
the most frequently hit genes on this cohort are VPS13B, LRBA, ZBTB20 and CNTNAP2, all 1-2Mb -- and
gene length is also correlated with expression level and variance. Comparing hit genes to all other
genes would therefore recover gene length, not methylation.

So genes are binned by log2 length and hits are compared to non-hits WITHIN each bin, the same
stratified design the matched-background correction uses. The reported effect is the hit-minus-
non-hit difference averaged over bins, weighted by how many hits each bin holds, and its p comes
from permuting the hit labels inside bins -- which preserves the length distribution exactly. */

/** Width of a length stratum, in log2 units. A quarter of a log2 is ~19% in length; narrow enough
 * that a bin is genuinely length-matched, wide enough to hold non-hits to compare against. */
const LEN_BIN = 0.25

/** A bin with fewer than this on either side cannot support a comparison and is dropped, with its
 * hits reported as unmatched rather than silently pooled into a neighbouring length. */
const MIN_PER_SIDE = 5

/** Permutations for the label-shuffle null. 2000 gives a resolution floor of 1/2001. */
import { median, makeRng } from './dmrStats.ts'

const N_PERM = 2000

export type GeneFC = { gene: string; fc: number; len: number }

export type StratumRow = {
	/** lower edge of the bin, in bp */
	lenFrom: number
	lenTo: number
	nHit: number
	nOther: number
	medianHit: number
	medianOther: number
	diff: number
}

/** Weighted mean of per-bin differences, weighting each bin by its hit count -- so the summary
 * answers "what happened to the average HIT gene", not "what happened to the average bin". */
function weightedDiff(bins: { nHit: number; diff: number }[]): number {
	let w = 0
	let acc = 0
	for (const b of bins) {
		if (!Number.isFinite(b.diff)) continue
		acc += b.diff * b.nHit
		w += b.nHit
	}
	return w ? acc / w : NaN
}

export function lengthStratifiedDE(
	genes: GeneFC[],
	hitSet: Set<string>,
	seed = 1
): {
	strata: StratumRow[]
	weightedDiff: number
	p: number
	nHit: number
	nOther: number
	unmatchedHits: number
} {
	const byBin = new Map<number, { hit: number[]; other: number[] }>()
	let hitsSeen = 0
	for (const g of genes) {
		if (!Number.isFinite(g.fc) || !(g.len > 0)) continue
		const k = Math.floor(Math.log2(g.len) / LEN_BIN)
		const b = byBin.get(k) || { hit: [], other: [] }
		if (hitSet.has(g.gene)) {
			b.hit.push(g.fc)
			hitsSeen++
		} else b.other.push(g.fc)
		byBin.set(k, b)
	}
	const usable: { k: number; hit: number[]; other: number[] }[] = []
	let unmatchedHits = 0
	for (const [k, b] of byBin) {
		if (b.hit.length >= MIN_PER_SIDE && b.other.length >= MIN_PER_SIDE) usable.push({ k, ...b })
		else unmatchedHits += b.hit.length
	}
	usable.sort((a, b) => a.k - b.k)
	const strata: StratumRow[] = usable.map(b => {
		const mh = median(b.hit)
		const mo = median(b.other)
		return {
			lenFrom: Math.round(Math.pow(2, b.k * LEN_BIN)),
			lenTo: Math.round(Math.pow(2, (b.k + 1) * LEN_BIN)),
			nHit: b.hit.length,
			nOther: b.other.length,
			medianHit: mh,
			medianOther: mo,
			diff: mh - mo
		}
	})
	const observed = weightedDiff(strata)

	/* Permute the hit label WITHIN each bin. Shuffling globally would break the length matching --
	the null has to be "these genes are a random sample of genes THIS LONG", not "of any gene". */
	const rnd = makeRng(seed)
	let atLeast = 0
	for (let i = 0; i < N_PERM; i++) {
		const perm = usable.map(b => {
			const pool = [...b.hit, ...b.other]
			for (let j = pool.length - 1; j > 0; j--) {
				const t = Math.floor(rnd() * (j + 1))
				;[pool[j], pool[t]] = [pool[t], pool[j]]
			}
			const h = pool.slice(0, b.hit.length)
			const o = pool.slice(b.hit.length)
			return { nHit: h.length, diff: median(h) - median(o) }
		})
		const d = weightedDiff(perm)
		// one-sided in the observed direction; the prediction names a direction
		if (Number.isFinite(d) && (observed <= 0 ? d <= observed : d >= observed)) atLeast++
	}
	return {
		strata,
		weightedDiff: observed,
		p: (atLeast + 1) / (N_PERM + 1),
		nHit: strata.reduce((a, b) => a + b.nHit, 0),
		nOther: strata.reduce((a, b) => a + b.nOther, 0),
		unmatchedHits: unmatchedHits + (hitsSeen - strata.reduce((a, b) => a + b.nHit, 0) - unmatchedHits)
	}
}
