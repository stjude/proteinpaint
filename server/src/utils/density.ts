/* Kernel density estimate, ported from R's density() with its default arguments and cut = 0:
a gaussian kernel with the bw.nrd0 bandwidth, evaluated at 512 points from the min to the max value.

R does not sum a kernel at each output point. It spreads the values onto a grid that extends 4 bandwidths
past the data, convolves that grid with the kernel, and interpolates back to the output points. This
follows the same steps, so the result matches R's to rounding error, and the cost of the convolution does
not depend on the number of values. R convolves by FFT; this convolves directly, which on a 512-point grid
is cheap enough and gives the same sums. The grid spacing is that of R 4.4 and later (old.coords = FALSE). */

const gridSize = 512
const ext = 4

export type Density = { x: number[]; y: number[] }

/** Density of the values. As in the R script this replaced, 5 or fewer values, or values that are all the
 * same, give a flat line on the values themselves instead. */
export function kernelDensity(values: number[]): Density {
	for (const v of values) {
		if (!Number.isFinite(v)) throw new Error('kernelDensity() values must be finite numbers')
	}
	if (values.length <= 5 || new Set(values).size == 1) return { x: [...values], y: values.map(() => 0) }

	const bw = bwNrd0(values)
	let from = Infinity,
		to = -Infinity
	for (const v of values) {
		if (v < from) from = v
		if (v > to) to = v
	}
	const lo = from - ext * bw
	const up = to + ext * bw
	const counts = binDist(values, lo, up, gridSize)

	// the kernel only depends on the distance between two grid points
	const delta = (up - lo) / (gridSize - 1)
	const kernel = new Float64Array(gridSize)
	for (let i = 0; i < gridSize; i++) kernel[i] = dnorm(i * delta, bw)

	const gridY = new Float64Array(gridSize)
	for (let k = 0; k < gridSize; k++) {
		let sum = 0
		for (let j = 0; j < gridSize; j++) sum += counts[j] * kernel[Math.abs(j - k)]
		gridY[k] = sum
	}

	const gridX = seq(lo, up, gridSize)
	const x = seq(from, to, gridSize)
	return { x, y: x.map(v => approx(gridX, gridY, v)) }
}

/** R's bw.nrd0(), Silverman's rule of thumb: 0.9 * min(sd, IQR / 1.34) * n^-0.2 */
export function bwNrd0(values: number[]): number {
	if (values.length < 2) throw new Error('bwNrd0() needs at least 2 values')
	const hi = sd(values)
	let lo = Math.min(hi, iqr(values) / 1.34)
	if (!lo) lo = hi || Math.abs(values[0]) || 1
	return 0.9 * lo * values.length ** -0.2
}

/** Spreads each value between the two nearest of n grid points from lo to hi, weighted by how close it
 * is to each. The weights sum to 1. As C_BinDist in R's massdist.c. */
function binDist(values: number[], lo: number, hi: number, n: number): Float64Array {
	const y = new Float64Array(n)
	const w = 1 / values.length
	const xdelta = (hi - lo) / (n - 1)
	for (const v of values) {
		const xpos = (v - lo) / xdelta
		const ix = Math.floor(xpos)
		const fx = xpos - ix
		if (ix >= 0 && ix <= n - 2) {
			y[ix] += w * (1 - fx)
			y[ix + 1] += w * fx
		} else if (ix == -1) {
			y[0] += w * fx
		} else if (ix == n - 1) {
			y[ix] += w * (1 - fx)
		}
	}
	return y
}

function dnorm(x: number, sd: number): number {
	const z = x / sd
	return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI))
}

/** n evenly spaced numbers from `from` to `to`, both included */
function seq(from: number, to: number, n: number): number[] {
	const by = (to - from) / (n - 1)
	const s = Array.from({ length: n }, (_, i) => from + i * by)
	s[n - 1] = to
	return s
}

/** Linear interpolation of y at v, as R's approx() for a v within x */
function approx(x: ArrayLike<number>, y: ArrayLike<number>, v: number): number {
	let i = 0,
		j = x.length - 1
	while (i < j - 1) {
		const ij = (i + j) >> 1
		if (v < x[ij]) j = ij
		else i = ij
	}
	if (v == x[j]) return y[j]
	if (v == x[i]) return y[i]
	return y[i] + (y[j] - y[i]) * ((v - x[i]) / (x[j] - x[i]))
}

/** Sample standard deviation, dividing by n - 1 */
function sd(values: number[]): number {
	const n = values.length
	let mean = 0
	for (const v of values) mean += v
	mean /= n
	// a second pass corrects the rounding error of the first, as R's mean() does
	let correction = 0
	for (const v of values) correction += v - mean
	mean += correction / n
	let ss = 0
	for (const v of values) ss += (v - mean) ** 2
	return Math.sqrt(ss / (n - 1))
}

/** Interquartile range, with R's default (type 7) quantiles */
function iqr(values: number[]): number {
	const sorted = Float64Array.from(values).sort()
	return quantile7(sorted, 0.75) - quantile7(sorted, 0.25)
}

function quantile7(sorted: Float64Array, p: number): number {
	const index = (sorted.length - 1) * p
	const lo = Math.floor(index)
	const hi = Math.ceil(index)
	const q = sorted[lo]
	if (index > lo && sorted[hi] != q) {
		const h = index - lo
		return (1 - h) * q + h * sorted[hi]
	}
	return q
}
