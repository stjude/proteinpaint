export type BoxplotValue = { value: number }

export type BoxplotResult<T extends number | BoxplotValue> = {
	w1?: number
	w2?: number
	p05?: number
	p25?: number
	p50?: number
	p75?: number
	p95?: number
	iqr?: number
	out: T[]
}

/**
 * Calculates boxplot values from an ascending array. Object inputs are retained
 * in `out`; numeric inputs return numeric outliers.
 */
export function boxplot_getvalue<T extends number | BoxplotValue>(lst: T[], removeOutliers = false): BoxplotResult<T> {
	const l = lst.length
	if (l < 5) return { out: lst }

	const isN = typeof lst[0] === 'number'

	const valueOf: (item: T) => number = isN ? item => item as number : item => (item as BoxplotValue).value

	const p50 = valueOf(lst[Math.floor(l / 2)])
	const p25 = valueOf(lst[Math.floor(l / 4)])
	const p75 = valueOf(lst[Math.floor((l * 3) / 4)])
	const p05 = valueOf(lst[Math.floor(l * 0.05)])
	const p95 = valueOf(lst[Math.floor(l * 0.95)])
	const iqr = p75 - p25

	let w1: number, w2: number
	if (iqr === 0) {
		w1 = p25
		w2 = p25
	} else {
		const i = lst.findIndex(item => valueOf(item) > p25 - iqr * 1.5)
		w1 = valueOf(lst[i === -1 ? 0 : i])
		const j = lst.findIndex(item => valueOf(item) > p75 + iqr * 1.5)
		w2 = valueOf(lst[j === -1 ? l - 1 : j - 1])
	}
	const out = removeOutliers
		? []
		: lst.filter(item => valueOf(item) < p25 - iqr * 1.5 || valueOf(item) > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}
