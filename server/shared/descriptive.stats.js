import computePercentile from './compute.percentile'
import roundValue from './roundValue'

/* This file generates summary statistics on any given array of numbers*/

export function summaryStats(array) {
	let arr = array
	if (typeof array[0] == 'string') {
		// somehow the values can be string but not numbers
		// must cast to numbers to properly compute values
		arr = array.map(Number)
	}
	const n = arr.length

	//compute mean
	function mean(arr) {
		return arr.reduce((a, b) => a + b) / n
	}

	//compute median
	const median = computePercentile(arr, 50)

	const squareDiffs = arr.map(x => (x - mean(arr)) ** 2).reduce((a, b) => a + b, 0)
	// compute variance
	const variance = squareDiffs / (n - 1)
	// compute standard deviation
	const stdDev = Math.sqrt(variance)

	//compute percentile ranges
	const p25 = computePercentile(arr, 25)
	const p75 = computePercentile(arr, 75)

	//compute IQR
	const IQR = p75 - p25

	const min = Math.min(...arr)
	const max = Math.max(...arr)

	//TODO outliers

	return {
		values: [
			{ id: 'total', label: 'Total', value: n },
			{ id: 'min', label: 'Minimum', value: roundValue(min, 2) },
			{ id: 'p25', label: '1st quartile', value: roundValue(p25, 2) },
			{ id: 'median', label: 'Median', value: roundValue(median, 2) },
			{ id: 'mean', label: 'Mean', value: roundValue(mean(arr), 2) },
			{ id: 'p75', label: '3rd quartile', value: roundValue(p75, 2) },
			{ id: 'max', label: 'Maximum', value: roundValue(max, 2) },
			{ id: 'SD', label: 'Standard deviation', value: roundValue(stdDev, 2) },
			{ id: 'variance', label: 'Variance', value: roundValue(variance, 2) },
			{ id: 'IQR', label: 'Inter-quartile range', value: roundValue(IQR, 2) }
		]
	}
}

export function boxplot_getvalue(lst) {
	/* ascending order
    each element: {value}
    */
	const l = lst.length
	if (l < 5) {
		// less than 5 items, won't make boxplot
		return { out: lst }
	}
	const p50 = lst[Math.floor(l / 2)].value
	const p25 = lst[Math.floor(l / 4)].value
	const p75 = lst[Math.floor((l * 3) / 4)].value
	const p05 = lst[Math.floor(l * 0.05)].value
	const p95 = lst[Math.floor(l * 0.95)].value
	const p01 = lst[Math.floor(l * 0.01)].value
	const iqr = p75 - p25

	let w1, w2
	if (iqr == 0) {
		w1 = 0
		w2 = 0
	} else {
		const i = lst.findIndex(i => i.value > p25 - iqr * 1.5)
		w1 = lst[i == -1 ? 0 : i].value
		const j = lst.findIndex(i => i.value > p75 + iqr * 1.5)
		w2 = lst[j == -1 ? l - 1 : j - 1].value
	}
	const out = lst.filter(i => i.value < p25 - iqr * 1.5 || i.value > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}
