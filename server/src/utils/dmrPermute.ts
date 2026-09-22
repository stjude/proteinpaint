/* Label permutation for a DMR scan's null distribution.

Why the scan needs one: DMRcate's region FDR is not calibrated at the region level (its own authors
say so, and the doc quotes them), and the background correction's empirical p is floored at
1/(windows + 1), so Benjamini-Hochberg over a scan's tests is decided by how many regions the
caller emitted rather than by the evidence -- it rejects all of them or none. The number that IS
calibrated is an empirical FDR from permuting the group labels and re-running the whole pipeline:
how many regions clear the same thresholds when the grouping means nothing.

This swaps which group each sample sits in, nothing else. The sample VALUES are passed through
untouched, so the caller never has to know whether a value carries a numeric sample id, a name or a
case uuid -- which matters because resolving those is dataset-specific and happens downstream.
Group sizes are preserved exactly, because an FDR estimated at a different n would not describe the
observed run.

Deterministic in `seed`: the same seed gives the same split, so a permutation can be re-run, cached
and compared. Sequential seeds give independent splits -- the generator below is seeded through a
mixing step rather than used raw, so seeds 1 and 2 do not produce correlated shuffles. */

/** mulberry32: a small, well-distributed 32-bit PRNG. Chosen over Math.random() because the split
 * has to be reproducible from the seed alone, and over a hash-of-index scheme because a real
 * generator gives a uniform Fisher-Yates rather than a biased one. */
function mulberry32(seed: number) {
	let a = seed >>> 0
	return function () {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** Mix the seed so that 1, 2, 3... are not near-neighbours in the generator's state space; without
 * this, low sequential seeds produce visibly similar first swaps. */
function mixSeed(seed: number) {
	let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
	return (h ^ (h >>> 16)) >>> 0
}

/** Reassign group membership at random, keeping both group sizes. Returns new arrays; the inputs
 * and the value objects inside them are not modified, because the caller still uses the originals
 * to report what was actually contrasted. */
export function permuteGroups<T>(group1: T[], group2: T[], seed: number): { group1: T[]; group2: T[] } {
	const pooled = [...group1, ...group2]
	const rand = mulberry32(mixSeed(seed))
	// Fisher-Yates over the pooled list, then cut at the original boundary
	for (let i = pooled.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[pooled[i], pooled[j]] = [pooled[j], pooled[i]]
	}
	return { group1: pooled.slice(0, group1.length), group2: pooled.slice(group1.length) }
}
