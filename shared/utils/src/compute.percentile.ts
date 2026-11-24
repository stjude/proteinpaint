// compute the percentile value from an array of values
// sorted parameter allows to skip sorting if array is pre-sorted
// source: https://www.dummies.com/article/academics-the-arts/math/statistics/how-to-calculate-percentiles-in-statistics-169783/
export default function computePercentile(values, percentile, sorted = false) {
	if (!sorted) values.sort((a, b) => a - b)
	const index = (percentile / 100) * values.length - 1
	// a low percentile can produce a negative index; the first value is the answer there.
	// taking Math.abs() of that index used to reflect it into the middle of the array.
	if (index < 0) return values[0]
	// an integer index averages with its successor, except at the upper boundary where
	// that successor does not exist (e.g. percentile 100)
	const value =
		Number.isInteger(index) && index + 1 < values.length
			? (values[index] + values[index + 1]) / 2
			: values[Math.ceil(index)]
	return value
}
