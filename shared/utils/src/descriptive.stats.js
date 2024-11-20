import { roundValueAuto } from './roundValue.js'

/* This file generates summary statistics on any given array of numbers*/

export default function summaryStats(array) {
	//console.log("array:",array)
	let arr = array
	if (typeof array[0] == 'string') {
		// somehow the values can be string but not numbers
		// must cast to numbers to properly compute values
		arr = array.map(Number)
	}
	//compute total
	const sorted_arr = arr.sort((a, b) => a - b)
	const n = arr.length

	//compute mean
	function mean(arr) {
		if (arr.length === 0) throw new Error('No data provided')
		return arr.reduce((a, b) => a + b) / n
	}

	//compute median
	const median = computePercentile(sorted_arr, 50)
	const mean_arr = mean(sorted_arr)
	const squareDiffs = arr.map(x => (x - mean_arr) ** 2).reduce((a, b) => a + b, 0)
	// compute variance
	const variance = squareDiffs / (n - 1)
	// compute standard deviation
	const stdDev = Math.sqrt(variance)

	//compute percentile ranges
	const p25 = computePercentile(sorted_arr, 25)
	const p75 = computePercentile(sorted_arr, 75)

	//compute IQR
	const IQR = p75 - p25
	const min = sorted_arr[0]
	const max = sorted_arr[sorted_arr.length - 1]
	//TODO outliers

	return {
		values: [
			{ id: 'total', label: 'Total', value: n },
			{ id: 'min', label: 'Minimum', value: roundValueAuto(min) },
			{ id: 'p25', label: '1st quartile', value: roundValueAuto(p25) },
			{ id: 'median', label: 'Median', value: roundValueAuto(median) },
			{ id: 'mean', label: 'Mean', value: roundValueAuto(mean(arr)) },
			{ id: 'p75', label: '3rd quartile', value: roundValueAuto(p75) },
			{ id: 'max', label: 'Maximum', value: roundValueAuto(max) },
			{ id: 'SD', label: 'Standard deviation', value: roundValueAuto(stdDev) },
			{ id: 'variance', label: 'Variance', value: roundValueAuto(variance) },
			{ id: 'IQR', label: 'Inter-quartile range', value: roundValueAuto(IQR) }
		]
	}
}

function computePercentile(values, percentile) {
	const index = Math.abs((percentile / 100) * values.length - 1)
	const value = Number.isInteger(index) ? (values[index] + values[index + 1]) / 2 : values[Math.ceil(index)]
	return value
}
