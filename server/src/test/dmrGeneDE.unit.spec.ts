import tape from 'tape'
import { lengthStratifiedDE, type GeneFC } from '#src/utils/dmrGeneDE.ts'

/*
test sections:

lengthStratifiedDE: recovers a real effect present within length strata
lengthStratifiedDE: does NOT recover a length confound dressed as an effect
lengthStratifiedDE: bins too thin on either side are dropped, not pooled
*/

/** The whole point of stratifying is that the frequently-hit genes are the longest ones -- VPS13B,
 * LRBA and CNTNAP2 all span 1-2Mb -- so a comparison against all other genes would recover gene
 * length rather than methylation. The second test is the one that matters: a dataset where hits
 * are simply the long genes, and long genes simply have lower fold change, must come back null. */

const mk = (n: number, len: number, fc: (i: number) => number, pre: string): GeneFC[] =>
	Array.from({ length: n }, (_, i) => ({ gene: `${pre}${len}_${i}`, fc: fc(i), len }))

tape('\n', t => {
	t.comment('-***- dmrGeneDE specs -***-')
	t.end()
})

tape('recovers an effect that is present within every length stratum', t => {
	const genes: GeneFC[] = []
	const hits = new Set<string>()
	for (const len of [10_000, 40_000, 160_000, 640_000]) {
		const h = mk(20, len, i => -0.5 + (i % 20) * 0.001, 'H')
		const o = mk(40, len, i => 0 + (i % 20) * 0.001, 'O')
		h.forEach(g => hits.add(g.gene))
		genes.push(...h, ...o)
	}
	const r = lengthStratifiedDE(genes, hits, 1)
	t.equal(r.strata.length, 4, 'all four length strata usable')
	t.ok(r.weightedDiff < -0.4, `hits sit ~0.5 lower within strata (got ${r.weightedDiff.toFixed(3)})`)
	t.ok(r.p < 0.01, `and the within-bin permutation rejects (p=${r.p})`)
	t.end()
})

tape('does not mistake a length confound for an effect', t => {
	/* Hits are ONLY the long genes, and fold change depends only on length. Comparing hits to all
	other genes would show a large difference; comparing within length must show none. */
	const genes: GeneFC[] = []
	const hits = new Set<string>()
	for (const len of [10_000, 40_000, 160_000, 640_000]) {
		const fcForLen = -Math.log2(len) / 10 // longer gene => lower fold change, for every gene
		/* Hits and non-hits draw from the SAME spread within a length, so any difference the test
		reports has to come from the length confound rather than from how the fixture was built.
		(A first version ramped both over their own index, which gave the larger group a higher
		median by construction -- and the permutation correctly flagged that 0.01 offset.) */
		const h = mk(20, len, i => fcForLen + (i % 20) * 0.001, 'H')
		const o = mk(40, len, i => fcForLen + (i % 20) * 0.001, 'O')
		// only the long strata contribute hits, exactly as a length-driven hit list would
		if (len >= 160_000) h.forEach(g => hits.add(g.gene))
		genes.push(...h, ...o)
	}
	const r = lengthStratifiedDE(genes, hits, 1)
	t.ok(Math.abs(r.weightedDiff) < 0.05, `no within-length difference (got ${r.weightedDiff.toFixed(4)})`)
	t.ok(r.p > 0.05, `and the permutation does not reject (p=${r.p})`)
	t.end()
})

tape('a stratum thin on either side is dropped rather than pooled', t => {
	const genes: GeneFC[] = []
	const hits = new Set<string>()
	// usable bin
	const h1 = mk(10, 50_000, () => -1, 'H')
	const o1 = mk(10, 50_000, () => 0, 'O')
	// bin with only 2 hits -- below MIN_PER_SIDE
	const h2 = mk(2, 400_000, () => -9, 'H')
	const o2 = mk(30, 400_000, () => 0, 'O')
	;[...h1, ...h2].forEach(g => hits.add(g.gene))
	genes.push(...h1, ...o1, ...h2, ...o2)
	const r = lengthStratifiedDE(genes, hits, 1)
	t.equal(r.strata.length, 1, 'only the populated bin is used')
	t.equal(r.nHit, 10, 'and only its hits are counted')
	t.equal(r.unmatchedHits, 2, "the thin bin's hits are reported as unmatched, not merged")
	t.ok(Math.abs(r.weightedDiff + 1) < 1e-9, 'the -9 outliers cannot leak into the estimate')
	t.end()
})

tape('p is bounded below and the run is deterministic', t => {
	const genes: GeneFC[] = []
	const hits = new Set<string>()
	const h = mk(30, 50_000, () => -5, 'H')
	const o = mk(30, 50_000, () => 5, 'O')
	h.forEach(g => hits.add(g.gene))
	genes.push(...h, ...o)
	const a = lengthStratifiedDE(genes, hits, 7)
	const b = lengthStratifiedDE(genes, hits, 7)
	t.equal(a.p, b.p, 'same seed, same p')
	t.ok(a.p >= 1 / 2001, 'p never reaches zero -- the floor is 1/(perms+1)')
	t.end()
})
