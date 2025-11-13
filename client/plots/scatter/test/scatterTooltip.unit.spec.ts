import tape from 'tape'
import { distance } from '../viewmodel/scatterTooltip.ts'
import { scaleLinear as d3Linear } from 'd3-scale'

/** Tests:
 * 	- Distance() should return the correct value when in range
 * 	- Distance() should return in range value for out-of-bounds x value
 * 	- Distance() should return in range value for out-of-bounds y value
 */

const mockChart = {
	xAxisScale: d3Linear().domain([0, 100]).range([0, 500]),
	yAxisScale: d3Linear().domain([0, 100]).range([500, 0]),
	width: 600,
	heigth: 600
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sampleScatter/viewmodel/scatterTooltip -***-')
	test.end()
})

tape('Distance() should return the correct value when in range', function (test) {
	test.timeoutAfter(100)

	const x1 = 10
	const y1 = 20
	const x2 = 30
	const y2 = 40
	const expected = 141.4213562373095
	const dist = distance(x1, y1, x2, y2, mockChart)

	test.ok(typeof dist === 'number', 'distance should return a number')
	test.equal(dist, expected, 'Should return the correct value for distance')
	test.end()
})

tape('Distance() should return in range value for out-of-bounds x value', function (test) {
	test.timeoutAfter(100)

	const x1 = 10
	const y1 = 20
	const x2 = 105
	const y2 = 40
	const expected = 485.41219597368996
	const dist = distance(x1, y1, x2, y2, mockChart)

	test.ok(typeof dist === 'number', 'distance should return a number')
	test.equal(dist, expected, 'Should return the correct value for distance')
	test.end()
})

tape('Distance() should return in range value for out-of-bounds y value', function (test) {
	test.timeoutAfter(100)

	const x1 = 10
	const y1 = 120
	const x2 = 30
	const y2 = 40
	const expected = 316.22776601683796
	const dist = distance(x1, y1, x2, y2, mockChart)

	test.ok(typeof dist === 'number', 'distance should return a number')
	test.equal(dist, expected, 'Should return the correct value for distance')
	test.end()
})
