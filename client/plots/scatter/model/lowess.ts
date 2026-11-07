/*
LOWESS scatterplot smoother of Cleveland (1979, JASA 74:829-836), as computed by R's lowess():
locally weighted linear fits with tricube weights over the nearest f*n points, followed by iter
robustness iterations that downweight points with large residuals by bisquare weights of 6 * the
median absolute residual. To save time, fits are computed only at points more than delta apart
in x, and points in between are linearly interpolated.

The defaults are R's: f = 2/3, iter = 3, and delta = 1% of the x range. The results match R's to
floating point rounding.

Returns one [x, fitted y] pair per input point, sorted by x. Points with the same x keep their
input order, as with R's order(). Throws on mismatched lengths or a value that is not finite.
*/

export type LowessOpts = {
	/** fraction of the points used for each local fit, > 0 */
	f?: number
	/** number of robustness iterations, >= 0 */
	iter?: number
	/** fits are skipped for points within this x distance of the last fitted point, >= 0 */
	delta?: number
}

export function lowess(X: number[], Y: number[], opts: LowessOpts = {}): [number, number][] {
	const n = X.length
	if (Y.length != n) throw new Error('lowess: X and Y have different lengths')
	if (!n) return []
	for (let i = 0; i < n; i++) {
		if (!Number.isFinite(X[i]) || !Number.isFinite(Y[i])) throw new Error('lowess: X and Y must be finite numbers')
	}

	// Array.prototype.sort() is stable, so ties keep their input order
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => X[a] - X[b])
	const x = Float64Array.from(order, i => X[i])
	const y = Float64Array.from(order, i => Y[i])

	const f = opts.f ?? 2 / 3
	const iter = opts.iter ?? 3
	const delta = opts.delta ?? 0.01 * (x[n - 1] - x[0])
	if (!Number.isFinite(f) || f <= 0) throw new Error('lowess: f must be finite and > 0')
	if (!Number.isInteger(iter) || iter < 0) throw new Error('lowess: iter must be an integer >= 0')
	if (!Number.isFinite(delta) || delta < 0) throw new Error('lowess: delta must be finite and >= 0')

	const ys = smooth(x, y, f, iter, delta)
	return Array.from(x, (xi, i) => [xi, ys[i]])
}

/** x must be sorted ascending; returns the fitted values */
function smooth(x: Float64Array, y: Float64Array, f: number, iter: number, delta: number): Float64Array {
	const n = x.length
	const ys = new Float64Array(n)
	if (n < 2) {
		ys[0] = y[0]
		return ys
	}
	// number of points in each local fit, from 2 to n
	const ns = Math.max(2, Math.min(n, Math.floor(f * n + 1e-7)))
	const w = new Float64Array(n) // local fit weights
	const rw = new Float64Array(n) // robustness weights
	const res = new Float64Array(n) // residuals

	for (let it = 0; it <= iter; it++) {
		// window of ns points [nleft, nright] around point i
		let nleft = 0
		let nright = ns - 1
		let last = -1 // last fitted point
		let i = 0 // point to fit
		while (true) {
			// slide the window right while that brings its farther end closer to x[i]
			if (nright < n - 1 && x[i] - x[nleft] > x[nright + 1] - x[i]) {
				nleft++
				nright++
				continue
			}
			// a point whose local weights are all 0 keeps its value
			ys[i] = fitAt(x, y, x[i], nleft, nright, w, it > 0 ? rw : null) ?? y[i]
			// interpolate the skipped points between the last fitted point and this one
			if (last < i - 1) {
				const denom = x[i] - x[last]
				for (let j = last + 1; j < i; j++) {
					const alpha = (x[j] - x[last]) / denom
					ys[j] = alpha * ys[i] + (1 - alpha) * ys[last]
				}
			}
			last = i
			// skip the points within delta of this one, copying the fit to the points tied with it
			const cut = x[last] + delta
			for (i = last + 1; i < n; i++) {
				if (x[i] > cut) break
				if (x[i] == x[last]) {
					ys[i] = ys[last]
					last = i
				}
			}
			i = Math.max(last + 1, i - 1)
			if (last >= n - 1) break
		}

		if (it == iter) break

		for (let k = 0; k < n; k++) res[k] = y[k] - ys[k]
		// mean absolute residual, the overall scale
		let sc = 0
		for (let k = 0; k < n; k++) sc += Math.abs(res[k])
		sc /= n
		// 6 * median absolute residual
		const sorted = Float64Array.from(res, Math.abs).sort()
		const m1 = Math.floor(n / 2)
		const cmad = n % 2 == 0 ? 3 * (sorted[m1] + sorted[n - m1 - 1]) : 6 * sorted[m1]
		// residuals are effectively 0
		if (cmad < 1e-7 * sc) break
		// bisquare robustness weights
		const c9 = 0.999 * cmad
		const c1 = 0.001 * cmad
		for (let k = 0; k < n; k++) {
			const r = Math.abs(res[k])
			if (r <= c1) rw[k] = 1
			else if (r <= c9) {
				const u = r / cmad
				const t = 1 - u * u
				rw[k] = t * t
			} else rw[k] = 0
		}
	}
	return ys
}

/*
Fitted value at xs by a weighted linear fit over the points from nleft, through nright and any
points tied with x[nright]. Uses w as scratch space for the weights, and multiplies them by the
robustness weights rw when given. Returns undefined when all the weights are 0.
*/
function fitAt(
	x: Float64Array,
	y: Float64Array,
	xs: number,
	nleft: number,
	nright: number,
	w: Float64Array,
	rw: Float64Array | null
): number | undefined {
	const n = x.length
	const range = x[n - 1] - x[0]
	// window radius
	const h = Math.max(xs - x[nleft], x[nright] - xs)
	const h9 = 0.999 * h
	const h1 = 0.001 * h

	// tricube weights; the loop goes past nright to include points tied with x[nright]
	let sum = 0
	let j = nleft
	for (; j < n; j++) {
		w[j] = 0
		const r = Math.abs(x[j] - xs)
		if (r <= h9) {
			if (r <= h1) w[j] = 1
			else {
				const u = r / h
				const t = 1 - u * u * u
				w[j] = t * t * t
			}
			if (rw) w[j] *= rw[j]
			sum += w[j]
		} else if (x[j] > xs) break
	}
	const nrt = j - 1 // rightmost point in the fit
	if (sum <= 0) return

	for (let k = nleft; k <= nrt; k++) w[k] /= sum
	if (h > 0) {
		// weighted mean of x
		let mean = 0
		for (let k = nleft; k <= nrt; k++) mean += w[k] * x[k]
		// weighted sum of squares about the mean
		let ss = 0
		for (let k = nleft; k <= nrt; k++) {
			const d = x[k] - mean
			ss += w[k] * (d * d)
		}
		// use a linear fit when the points are spread out enough to estimate a slope;
		// otherwise the fit is the weighted mean of y
		if (Math.sqrt(ss) > 0.001 * range) {
			const b = (xs - mean) / ss
			for (let k = nleft; k <= nrt; k++) w[k] *= b * (x[k] - mean) + 1
		}
	}
	let fit = 0
	for (let k = nleft; k <= nrt; k++) fit += w[k] * y[k]
	return fit
}
