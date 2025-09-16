import tape from 'tape'
import { getMean, getVariance, getStdDev, summaryStats } from '../descriptive.stats.js'

/**
 * Tests
 *  - getMean()
 *  - getVariance()
 *  - getStdDev()
 *  - summaryStats()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #shared/descriptive.stats -***-')
	test.end()
})

tape('getMean()', function (test) {
	let data, expected, result

	data = [1, 2, 3, 4, 5]
	expected = 3
	result = getMean(data)
	test.equal(result, expected, `Should return mean=${expected} for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11]
	expected = 2
	result = getMean(data)
	test.equal(result, expected, `Should return mean=${expected} for input data=${data}`)

	data = [18903, 34892, 23498034]
	expected = 7850609.666666667
	result = getMean(data)
	test.equal(result, expected, `Should return mean=${expected} for input data=${data}`)

	test.end()
})

tape('getVariance()', function (test) {
	let data, expected, result

	data = [1, 2, 3, 4, 5]
	expected = 2.5
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11]
	expected = 62
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [18903, 34892, 23498034]
	expected = 183631480112574.3
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	test.end()
})

tape('getStdDev()', function (test) {
	let data, expected, result

	data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	expected = 3.0276503540974917
	result = getStdDev(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11, 48, 50]
	expected = 22.7580441037575
	result = getStdDev(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [2348, 13049, 18903, 34892, 23498034]
	expected = 10500910.96242034
	result = getStdDev(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	test.end()
})

tape('getStdDev()', function (test) {
	let data, expected, result

	data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	expected = {
		values: [
			{ id: 'total', label: 'Total', value: 10 },
			{ id: 'min', label: 'Minimum', value: 1 },
			{ id: 'p25', label: '1st quartile', value: 3 },
			{ id: 'median', label: 'Median', value: 5.5 },
			{ id: 'mean', label: 'Mean', value: 5.5 },
			{ id: 'p75', label: '3rd quartile', value: 8 },
			{ id: 'max', label: 'Maximum', value: 10 },
			{ id: 'SD', label: 'Standard deviation', value: 3.03 },
			{ id: 'variance', label: 'Variance', value: 9.17 },
			{ id: 'IQR', label: 'Inter-quartile range', value: 5 }
		]
	}
	result = summaryStats(data)
	test.deepEqual(result, expected, `Should return expected summary stats for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11, 48, 50]
	expected = {
		values: [
			{ id: 'total', label: 'Total', value: 8 },
			{ id: 'min', label: 'Minimum', value: -10 },
			{ id: 'p25', label: '1st quartile', value: -1 },
			{ id: 'median', label: 'Median', value: 6.5 },
			{ id: 'mean', label: 'Mean', value: 13.75 },
			{ id: 'p75', label: '3rd quartile', value: 29.5 },
			{ id: 'max', label: 'Maximum', value: 50 },
			{ id: 'SD', label: 'Standard deviation', value: 22.76 },
			{ id: 'variance', label: 'Variance', value: 517.93 },
			{ id: 'IQR', label: 'Inter-quartile range', value: 30.5 }
		]
	}
	result = summaryStats(data)
	test.deepEqual(result, expected, `Should return expected summary stats for input data=${data}`)

	data = [2348, 13049, 18903, 34892, 23498034]
	expected = {
		values: [
			{ id: 'total', label: 'Total', value: 5 },
			{ id: 'min', label: 'Minimum', value: 2348 },
			{ id: 'p25', label: '1st quartile', value: 13049 },
			{ id: 'median', label: 'Median', value: 18903 },
			{ id: 'mean', label: 'Mean', value: '4.7e+6' },
			{ id: 'p75', label: '3rd quartile', value: 34892 },
			{ id: 'max', label: 'Maximum', value: 23498034 },
			{ id: 'SD', label: 'Standard deviation', value: '1.1e+7' },
			{ id: 'variance', label: 'Variance', value: '1.1e+14' },
			{ id: 'IQR', label: 'Inter-quartile range', value: 21843 }
		]
	}
	result = summaryStats(data)
	test.deepEqual(result, expected, `Should return expected summary stats for input data=${data}`)

	test.end()
})
