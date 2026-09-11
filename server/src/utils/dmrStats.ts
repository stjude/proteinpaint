/* The two small numeric helpers the methylation analyses share.

Each existed as a private copy in three or four files, which is a problem beyond tidiness: the
permutation null in dmrGeneDE and the background sampler in dmrBackground are documented as "the
same correction", and a fix to the seeding or to the even-length median landing in one copy and not
the others would quietly make that untrue. */

/** Exact median, not mutating the input: the caller's array is reused across permutation
 * iterations, so sorting it in place would reorder the pool being sampled from. */
export function median(v: number[]): number {
	if (!v.length) return NaN
	const s = [...v].sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Deterministic xorshift PRNG, so an identical request draws identically and the result is
 * cacheable. Math.random would make the same request return different numbers and, worse, leave
 * one arbitrary draw in the cache forever. */
export function makeRng(seed: number) {
	let s = seed >>> 0 || 1
	return () => {
		s ^= s << 13
		s >>>= 0
		s ^= s >> 17
		s ^= s << 5
		s >>>= 0
		return s / 4294967296
	}
}

/** A chromosome's background-sampling seed. Derived from the name so each chromosome draws
 * independently but reproducibly, and shared so the scan's correction and the gene-body
 * correction cannot seed differently while claiming to be the same one. */
export function chrSeed(chr: string): number {
	return [...chr].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
}
