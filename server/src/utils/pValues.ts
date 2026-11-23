/* P-values on the log scale, so that a tail far below 1e-300 does not collapse to 0. No dependencies. */

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
