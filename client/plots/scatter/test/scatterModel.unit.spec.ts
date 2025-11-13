import tape from 'tape'
import { getCoordinate } from '../model/scatterModel.ts'

/** Tests:
 *  - getCoordinate returns value as coordinate when min and max are null
 *  - getCoordinate returns value when value is within min and max
 *  - getCoordinate returns min as coordinate when value smaller than min
 *  - getCoordinate returns max as coordinate when value greater than max
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sampleScatter/model/scatterModel -***-')
	test.end()
})

tape('getCoordinate returns value as coordinate when min and max are null', function (test) {
	test.timeoutAfter(100)
	const value = 5
	const min = null
	const max = null
	const result = getCoordinate(value, min, max)
	test.equal(result, value, 'getCoordinate should return the value when min and max are null')
	test.end()
})

tape('getCoordinate returns value when value is within min and max', function (test) {
	test.timeoutAfter(100)
	const value = 50
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, value, 'getCoordinate should return the value when value is within min and max')
	test.end()
})

tape('getCoordinate returns min as coordinate when value smaller than min', function (test) {
	test.timeoutAfter(100)
	const value = 5
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, min, 'getCoordinate should return min when value < min')
	test.end()
})

tape('getCoordinate returns max as coordinate when value greater than max', function (test) {
	test.timeoutAfter(100)
	const value = 105
	const min = 10
	const max = 100
	const result = getCoordinate(value, min, max)
	test.equal(result, max, 'getCoordinate should return max when value > max')
	test.end()
})
