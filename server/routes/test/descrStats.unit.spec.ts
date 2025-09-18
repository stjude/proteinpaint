import tape from 'tape'
import { getMean, getVariance, getStdDev, getDescrStats } from '../termdb.descrstats.ts'

/**
 * Tests
 *  - getMean()
 *  - getVariance()
 *  - getStdDev()
 *  - getDescrStats()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/descrStats -***-')
	test.end()
})

tape('getDescrStats()', function (test) {
	const data = [15, 20, 42, 26, 18, 4, 31, 19, 22, 15, 14, 4]
	const stats = getDescrStats(data)
	const expected = {
		total: { label: 'Total', value: 12 },
		min: { label: 'Minimum', value: 4 },
		p25: { label: '1st quartile', value: 14.5 },
		median: { label: 'Median', value: 18.5 },
		p75: { label: '3rd quartile', value: 24 },
		max: { label: 'Maximum', value: 42 },
		mean: { label: 'Mean', value: 19.17 },
		stdDev: { label: 'Standard deviation', value: 10.62 }
	}
	test.deepEqual(stats, expected, 'Should compute expected descriptive stats')
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
