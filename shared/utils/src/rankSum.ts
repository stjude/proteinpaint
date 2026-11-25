/* A Wilcoxon rank-sum test and Benjamini-Hochberg, shared so that the methylation track (client/dnameth) and the
two-group test of junctions (server/src/j2) compute the same p and q. No dependencies. */

/* two-sided p of a Wilcoxon rank-sum test of a against b, normal approximation with tie and continuity correction;
null with an empty group or no variation */
export function rankSumP(a: number[], b: number[]): number | null {
	const n1 = a.length,
		n2 = b.length,
		n = n1 + n2
	if (!n1 || !n2) return null
	const all = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))].sort((x, y) => x.v - y.v)
	// mid ranks of ties, and the tie term of the variance
	let r1 = 0,
		ties = 0
	for (let i = 0; i < n; ) {
		let j = i
		while (j + 1 < n && all[j + 1].v == all[i].v) j++
		const rank = (i + j + 2) / 2,
			t = j - i + 1
		for (let k = i; k <= j; k++) if (all[k].g == 0) r1 += rank
		ties += t * t * t - t
		i = j + 1
	}
	const u = r1 - (n1 * (n1 + 1)) / 2
	const sd = Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1))))
	if (!(sd > 0)) return null
	const z = Math.max(0, Math.abs(u - (n1 * n2) / 2) - 0.5) / sd
	return Math.min(1, 2 * normalUpper(z))
}

// P(Z > z) for a standard normal: erfc by W. J. Cody's rational approximation as in Numerical Recipes (erfcc), error < 1.2e-7
function normalUpper(z: number): number {
	const x = z / Math.SQRT2
	const t = 1 / (1 + 0.5 * x)
	const r =
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
	return r / 2
}

// Benjamini-Hochberg over the p-values that are not null
export function bh(p: (number | null)[]): (number | null)[] {
	const idx = p.map((v, i) => i).filter(i => p[i] !== null)
	idx.sort((a, b) => p[b]! - p[a]!)
	const q: (number | null)[] = p.map(() => null)
	let running = 1
	idx.forEach((i, r) => {
		running = Math.min(running, (p[i]! * idx.length) / (idx.length - r))
		q[i] = running
	})
	return q
}
