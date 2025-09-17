import { roundValueAuto } from './roundValue.js'

/* This file generates summary statistics on any given array of numbers*/

export function getDescriptiveStats(array) {
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

	// Calculate outlier boundaries
	const outlierMin = p25 - 1.5 * IQR //p25 is same as q1
	const outlierMax = p75 + 1.5 * IQR //p75 is same as q3

	return {
		total: n,
		min,
		max,
		p25,
		p75,
		median,
		mean,
		variance,
		stdDev,
		IQR,
		outlierMin,
		outlierMax
	}
}

export function summaryStats(array, showOutlierRange = false) {
	const stats = getDescriptiveStats(array)
	return summaryStatsFromStats(stats, showOutlierRange)
}

export function summaryStatsFromStats(stats, showOutlierRange = false) {
	const result = {
		values: [
			{ id: 'total', label: 'Total', value: stats.total },
			{ id: 'min', label: 'Minimum', value: roundValueAuto(stats.min, true) },
			{ id: 'p25', label: '1st quartile', value: roundValueAuto(stats.p25, true) },
			{ id: 'median', label: 'Median', value: roundValueAuto(stats.median, true) },
			{ id: 'mean', label: 'Mean', value: roundValueAuto(stats.mean, true) },
			{ id: 'p75', label: '3rd quartile', value: roundValueAuto(stats.p75, true) },
			{ id: 'max', label: 'Maximum', value: roundValueAuto(stats.max, true) },
			{ id: 'SD', label: 'Standard deviation', value: roundValueAuto(stats.stdDev, true) },
			{ id: 'variance', label: 'Variance', value: roundValueAuto(stats.variance, true) },
			{ id: 'IQR', label: 'Inter-quartile range', value: roundValueAuto(stats.IQR, true) }
		]
	}
	if (showOutlierRange) {
		result.values.push(
			{ id: 'outlierMin', label: 'Outlier min', value: roundValueAuto(stats.outlierMin, true) },
			{ id: 'outlierMax', label: 'Outlier max', value: roundValueAuto(stats.outlierMax, true) }
		)
	}
	return result
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
	//Using n−1 compensates for the fact that we're basing variance on a sample mean,
	// which tends to underestimate true variability. The correction is especially important with small sample sizes,
	// where dividing by n would significantly distort the variance estimate.
	// For more details see https://en.wikipedia.org/wiki/Bessel%27s_correction
	return squaredDifferences.reduce((sum, value) => sum + value, 0) / (data.length - 1)
}

export function getStdDev(data) {
	const variance = getVariance(data)
	return Math.sqrt(variance)
}
