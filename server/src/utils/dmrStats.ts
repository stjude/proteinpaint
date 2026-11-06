/* The two small numeric helpers the methylation analyses share.

Each existed as a private copy in three or four files, which is a problem beyond tidiness: the
permutation null in dmrGeneDE and the background sampler in dmrBackground are documented as "the
same correction", and a fix to the seeding or to the even-length median landing in one copy and not
the others would quietly make that untrue. */

/** Two-sided p of a standard-normal z: P(|Z| >= |z|) = erfc(|z| / sqrt 2). erfc by the Chebyshev fit of
 * Numerical Recipes (erfcc), whose error is under 1.2e-7 RELATIVE to the value everywhere -- far into the tail,
 * where an absolute-error approximation would turn a p of 1e-20 into noise or zero, and a multiple-testing
 * adjustment needs those small p to be right. Floored at 1e-300 so -log10 stays finite. */
export function normalTwoSidedP(z: number): number {
	const x = Math.abs(z) / Math.SQRT2
	const t = 1 / (1 + 0.5 * x)
	const erfc =
		t *
		Math.exp(
			-x * x -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
		)
	return Math.min(1, Math.max(1e-300, erfc))
}

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
