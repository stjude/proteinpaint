import { roundValueAuto } from './roundValue.js'

/* This file generates summary statistics on any given array of numbers*/

export function summaryStats(array) {
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

	//compute median
	const median = computePercentile(sorted_arr, 50)
	//compute mean
	const mean = getMean(arr)
	// compute variance
	const variance = getVariance(sorted_arr)
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
			{ id: 'min', label: 'Minimum', value: roundValueAuto(min, true) },
			{ id: 'p25', label: '1st quartile', value: roundValueAuto(p25, true) },
			{ id: 'median', label: 'Median', value: roundValueAuto(median, true) },
			{ id: 'mean', label: 'Mean', value: roundValueAuto(mean, true) },
			{ id: 'p75', label: '3rd quartile', value: roundValueAuto(p75, true) },
			{ id: 'max', label: 'Maximum', value: roundValueAuto(max, true) },
			{ id: 'SD', label: 'Standard deviation', value: roundValueAuto(stdDev, true) },
			{ id: 'variance', label: 'Variance', value: roundValueAuto(variance, true) },
			{ id: 'IQR', label: 'Inter-quartile range', value: roundValueAuto(IQR, true) }
		]
	}
}

function computePercentile(values, percentile) {
	const index = Math.abs((percentile / 100) * values.length - 1)
	const value = Number.isInteger(index) ? (values[index] + values[index + 1]) / 2 : values[Math.ceil(index)]
	return value
}

export function getMean(data) {
	return data.reduce((sum, value) => sum + value, 0) / data.length
}

export function getVariance(data) {
	const meanValue = getMean(data)
	const squaredDifferences = data.map(value => Math.pow(value - meanValue, 2))
	return squaredDifferences.reduce((sum, value) => sum + value, 0) / data.length
}

export function getStdDev(data) {
	const variance = getVariance(data)
	return Math.sqrt(variance)
}

export function getMedian(data) {
	data.sort((a, b) => b - a)
	return data[Math.floor(data.length / 2)]
}
