import tape from 'tape'
import { getCoordinate } from '../scatter.js'

/**
 * Tests
 *  - getCoordinate returns appropriate value when inbounds and out of bounds
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- date convert specs -***-')
	test.end()
})

tape('getCoordinate returns appropriate value when inbounds and out of bounds', function (test) {
	test.equal(getCoordinate(5, 0, 10), 5, 'returns the value if it is within the min and max bounds')
	test.equal(getCoordinate(-5, 0, 10), 0, 'returns the min if the value is below the min bound')
	test.equal(getCoordinate(15, 0, 10), 10, 'returns the max if the value is above the max bound')
	test.end()
})
