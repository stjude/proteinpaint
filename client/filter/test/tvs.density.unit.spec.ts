import tape from 'tape'
import * as d3s from 'd3-selection'
import { NumericRangeInput } from '#dom/numericRangeInput'
import { updateTempRanges } from '../tvs.density'
import { scaleLinear } from 'd3-scale'

/* Tests
    updateTempRanges
*/

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function createTestSelf(holder) {
	const callback = () => {
		//comment to avoid linting error
	}
	const testSelf = {
		num_obj: {
			brushes: [
				{
					elem: holder,
					orig: { start: '', stop: '', index: 0 },
					range: {
						start: '1962',
						stop: '2012',
						index: 0,
						startunbounded: false,
						stopunbounded: false
					},
					rangeInput: new NumericRangeInput(holder, [1962, 2012], callback)
				}
			],
			density_data: {
				maxvalue: 2012,
				minvalue: 1962
			},
			ranges: [
				{
					start: 1962,
					stop: 2012
				}
			],
			plot_size: {
				width: 500,
				height: 100,
				xpad: 10,
				ypad: 20
			},
			xscale: scaleLinear().domain([1962, 2012]).range([0, 500])
		}
	}

	return testSelf
}

tape('\n', test => {
	test.pass('-***- filter/tvs.density -***-')
	test.end()
})

tape('updateTempRanges', test => {
	test.timeoutAfter(100)
	test.plan(4)

	const holder = getHolder()
	const testSelf = createTestSelf(holder)
	const s = [259, 359]

	//Integer term
	const range1 = {
		start: '1987.3',
		stop: '1997.8',
		index: 0,
		startunbounded: false,
		stopunbounded: false
	} as any

	const origRange1 = structuredClone(range1)

	updateTempRanges(testSelf.num_obj.xscale, s, range1, range1, 1962, 2012, 'integer')

	test.ok(
		range1.start != origRange1.start && range1.start == 1988,
		'Should update start value in the original range and round to integer'
	)
	test.ok(
		range1.stop != origRange1.stop && range1.stop == 1998,
		'Should update stop value in the original range and round to integer'
	)

	//Non integer term
	const range2 = {
		start: 1987.3678,
		stop: 1997.823476,
		index: 0,
		startunbounded: false,
		stopunbounded: false
	} as any
	const origRange2 = structuredClone(range2)
	updateTempRanges(testSelf.num_obj.xscale, s, range2, range2, 1962, 2012, 'float')
	test.ok(range2.start != origRange2.start && range2.start == 1988, 'Should update start value in the original range.')
	test.ok(range2.stop != origRange2.stop && range2.stop == 1998, 'Should update stop value in the original range.')

	test.end()
})
