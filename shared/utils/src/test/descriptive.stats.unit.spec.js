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
	expected = 2
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11]
	expected = 51.666666666666664
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [18903, 34892, 23498034]
	expected = 122420986741716.2
	result = getVariance(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	test.end()
})

tape('getStdDev()', function (test) {
	let data, expected, result

	data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
	expected = 2.8722813232690143
	result = getStdDev(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [-10, -2, 0, 3, 10, 11, 48, 50]
	expected = 21.288200957337846
	result = getStdDev(data)
	test.equal(result, expected, `Should return variance=${expected} for input data=${data}`)

	data = [2348, 13049, 18903, 34892, 23498034]
	expected = 9392300.29505785
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
			{ id: 'SD', label: 'Standard deviation', value: 2.87 },
			{ id: 'variance', label: 'Variance', value: 8.25 },
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
			{ id: 'SD', label: 'Standard deviation', value: 21.29 },
			{ id: 'variance', label: 'Variance', value: 453.19 },
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
			{ id: 'SD', label: 'Standard deviation', value: '9.4e+6' },
			{ id: 'variance', label: 'Variance', value: '8.8e+13' },
			{ id: 'IQR', label: 'Inter-quartile range', value: 21843 }
		]
	}
	result = summaryStats(data)
	test.deepEqual(result, expected, `Should return expected summary stats for input data=${data}`)

	test.end()
})
