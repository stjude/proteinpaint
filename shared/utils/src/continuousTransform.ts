/* the "Scale values" option of a continuous numeric tw, from the termsetting edit menu. server getData() replaces
the stored values with the forward() values, so that a route analyzes and plots them, while a filter tests the
stored values, and the inverse() converts a plotted value, such as a brushed axis range, back to a stored value
- tw.q.scale=N divides a value by N
- tw.q.transform='log10p1' is log10(value+1), which has no value for a value of -1 or less */

export type ContinuousValueTransform = {
	forward: (v: number) => number
	inverse: (v: number) => number
}

/* returns undefined when the stored values are used as is */
export function getContinuousValueTransform(q: any): ContinuousValueTransform | undefined {
	if (q?.mode != 'continuous') return
	if (q.transform == 'log10p1') return { forward: v => Math.log10(v + 1), inverse: v => 10 ** v - 1 }
	if (q.transform) throw `unknown tw.q.transform='${q.transform}'`
	const scale = Number(q.scale)
	if (q.scale && scale != 1) {
		if (!Number.isFinite(scale)) throw `invalid tw.q.scale='${q.scale}'`
		return { forward: v => v / scale, inverse: v => v * scale }
	}
}

/* converts a range of plotted values to the range of the stored values that a filter tests. the range is widened by
a tiny fraction, so that a stored value at a bound, whose round trip through forward() and inverse() may end up just
outside of it, is still in the range */
export function getStoredValueRange(q: any, start: number, stop: number): { start: number; stop: number } {
	const transform = getContinuousValueTransform(q)
	if (!transform) return { start, stop }
	const a = transform.inverse(start),
		b = transform.inverse(stop)
	const lo = Math.min(a, b),
		hi = Math.max(a, b)
	return { start: lo - getMargin(lo), stop: hi + getMargin(hi) }
}

function getMargin(v: number) {
	return Math.max(1, Math.abs(v)) * 1e-9
}
