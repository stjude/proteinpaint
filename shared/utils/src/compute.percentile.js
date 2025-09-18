// compute the percentile value from an array of values
// sorted parameter allows to skip sorting if array is pre-sorted
// source: https://www.dummies.com/article/academics-the-arts/math/statistics/how-to-calculate-percentiles-in-statistics-169783/
export default function computePercentile(values, percentile, sorted = false) {
	if (!sorted) values.sort((a, b) => a - b)
	const index = Math.abs((percentile / 100) * values.length - 1)
	const value = Number.isInteger(index) ? (values[index] + values[index + 1]) / 2 : values[Math.ceil(index)]
	return value
}
