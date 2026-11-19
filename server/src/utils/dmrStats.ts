/** Exact median, not mutating the input. */
export function median(v: number[]): number {
	if (!v.length) return NaN
	const s = [...v].sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
