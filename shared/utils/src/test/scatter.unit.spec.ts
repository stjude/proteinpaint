import tape from 'tape'
import { getCoordinate, calculatePadding } from '../scatter.js'

/**
 * Tests
 *  - getCoordinate returns appropriate value when inbounds and out of bounds
 *  - getCoordinate returns the value if min and max bounds are null
 *  - calculatePadding returns 0 if either minScale or maxScale is not null
 *  - calculatePadding returns 1% of the range if both minScale and maxScale are null
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- shared/scatter -***-')
	test.end()
})

tape('getCoordinate returns appropriate value when inbounds and out of bounds', function (test) {
	test.equal(getCoordinate(5, 0, 10), 5, 'returns the value if it is within the min and max bounds')
	test.equal(getCoordinate(-5, 0, 10), 0, 'returns the min if the value is below the min bound')
	test.equal(getCoordinate(15, 0, 10), 10, 'returns the max if the value is above the max bound')
	test.end()
})

tape('getCoordinate returns the value if min and max bounds are null', function (test) {
	test.equal(getCoordinate(5, null, null), 5, 'returns the value if min and max bounds are null')
	test.end()
})

tape('calculatePadding returns 0 if either minScale or maxScale is not null', function (test) {
	test.equal(calculatePadding(0, null, 0, 10), 0, 'returns 0 if minScale is not null')
	test.equal(calculatePadding(null, 10, 0, 10), 0, 'returns 0 if maxScale is not null')
	test.end()
})

tape('calculatePadding returns 1% of the range if both minScale and maxScale are null', function (test) {
	test.equal(calculatePadding(null, null, 0, 10), 0.1, 'returns 1% of the range if both minScale and maxScale are null')
	test.end()
})
