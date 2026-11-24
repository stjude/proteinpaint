import tape from 'tape'
import computePercentile from '../compute.percentile.js'

tape('\n', function (test) {
	test.comment('-***- computePercentile specs -***-')
	test.end()
})

tape('computePercentile() sorts unsorted values and returns percentile values', test => {
	const values = [20, 3, 8, 10, 15, 6, 7, 8, 16, 13]

	test.equal(computePercentile(values, 25), 7, 'should return the 25th percentile')
	test.deepEqual(values, [3, 6, 7, 8, 8, 10, 13, 15, 16, 20], 'should sort values in place by default')
	test.end()
})

tape('computePercentile() averages adjacent values when percentile index is an integer', test => {
	const values = [3, 6, 7, 8, 8, 10, 13, 15, 16, 20]

	test.equal(computePercentile(values, 50, true), 9, 'should average adjacent values for the 50th percentile')
	test.end()
})

tape('computePercentile() uses pre-sorted values when sorted=true', test => {
	const values = [1, 2, 3, 4]

	test.equal(computePercentile(values, 75, true), 3.5, 'should return the percentile value without sorting')
	test.deepEqual(values, [1, 2, 3, 4], 'should leave pre-sorted values unchanged')
	test.end()
})

tape('computePercentile() returns the first value for percentiles below the first rank', test => {
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

	test.equal(computePercentile(values, 1, true), 1, 'should return the smallest value for the 1st percentile')
	test.equal(computePercentile(values, 5, true), 1, 'should return the smallest value for the 5th percentile')
	test.equal(computePercentile(values, 0, true), 1, 'should return the smallest value for the 0th percentile')
	test.equal(computePercentile([...values].reverse(), 1), 1, 'should also work when the values need sorting')
	test.end()
})

tape('computePercentile() returns the last value for the 100th percentile', test => {
	const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

	test.equal(computePercentile(values, 100, true), 10, 'should return the largest value for the 100th percentile')
	test.equal(computePercentile([1, 2, 3, 4], 100, true), 4, 'should not average past the end of the array')
	test.end()
})
