import tape from 'tape'
import * as d3s from 'd3-selection'
import { NumericRangeInput } from '#dom/numericRangeInput'
import { updateTempRanges, setStartStopDisplays } from '../tvs.density'
import { scaleLinear } from 'd3-scale'

/* Tests
	updateTempRanges
	setStartStop
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
	test.comment('-***- filter/tvs.density -***-')
	test.end()
})

tape('updateTempRanges', test => {
	test.timeoutAfter(100)
	test.plan(2)

	const holder = getHolder()
	const testSelf = createTestSelf(holder)

	let s: number[], range: any, inputRange: any, expected: any

	//Integer term
	s = [259, 359]
	range = {
		start: '1987.3',
		stop: '1997.8',
		index: 0,
		startunbounded: false,
		stopunbounded: false
	}
	inputRange = {
		start: 2000,
		startinclusive: true,
		startunbounded: false,
		stop: undefined,
		stopinclusive: true,
		stopunbounded: false,
		value: undefined
	}
	expected = {
		index: 0,
		start: 1988,
		startunbounded: false,
		stop: 1998,
		stopunbounded: false
	}
	updateTempRanges(testSelf.num_obj.xscale, s, range, inputRange, 1962, 2012, 'integer')
	test.deepEqual(range, expected, 'Should update start and stop values in the range object and round to integer')

	//Non integer term
	s = [200, 300]
	range = {
		start: 1987.3678,
		stop: 1997.823476,
		index: 0,
		startunbounded: false,
		stopunbounded: false
	}
	inputRange = {
		start: 2000.5,
		startinclusive: true,
		startunbounded: true,
		stop: undefined,
		stopinclusive: true,
		stopunbounded: false,
		value: undefined
	}
	expected = {
		index: 0,
		start: 1982,
		startunbounded: false,
		stop: 1992,
		stopunbounded: false
	}
	updateTempRanges(testSelf.num_obj.xscale, s, range, inputRange, 1962, 2012, 'continuous')
	test.deepEqual(range, expected, 'Should update start and stop values in the range object')

	holder.remove()
	test.end()
})

tape('setStartStopDisplays', test => {
	test.timeoutAfter(100)
	test.plan(8)

	let userInput: string, range: any, inputRange: any, expected: string[]

	// displays 10 < x <= [max value]
	userInput = `x > 10`
	range = {
		index: 0,
		start: 10,
		startunbounded: false,
		stop: 21.8,
		stopunbounded: false
	}
	inputRange = {
		start: 10,
		startinclusive: false,
		startunbounded: false,
		stop: undefined,
		stopinclusive: true,
		stopunbounded: true,
		value: undefined
	}
	expected = ['10 <', '<= 21.8']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays 10 <= x <= [max value]
	userInput = `x >= 10`
	inputRange.startinclusive = true
	expected = ['10 <=', '<= 21.8']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays [min value] <= x < 20
	userInput = `x < 20`
	range.start = 0
	range.stop = 20

	inputRange = {
		start: undefined,
		startinclusive: false,
		startunbounded: true,
		stop: 20,
		stopinclusive: false,
		stopunbounded: false,
		value: undefined
	}
	expected = ['0 <', '< 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays [min value] <= x <= 20
	userInput = 'x <= 20'
	inputRange = {
		start: undefined,
		startinclusive: true,
		startunbounded: true,
		stop: 20,
		stopinclusive: true,
		stopunbounded: true,
		value: undefined
	}
	expected = ['0 <=', '<= 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	// displays 10 < x < 20
	userInput = '10 < x < 20'
	range = {
		index: 0,
		start: 10,
		startunbounded: false,
		stop: 20,
		stopunbounded: false
	}
	inputRange = {
		start: 10,
		startinclusive: false,
		startunbounded: false,
		stop: 20,
		stopinclusive: false,
		stopunbounded: false,
		value: undefined
	}
	expected = ['10 <', '< 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays 10 <= x < 20
	userInput = '10 <= x < 20'
	inputRange = {
		start: 10,
		startinclusive: true,
		startunbounded: false,
		stop: 20,
		stopinclusive: false,
		stopunbounded: false,
		value: undefined
	}
	expected = ['10 <=', '< 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays 10 < x <= 20
	userInput = '10 < x <= 20'
	inputRange = {
		start: 10,
		startinclusive: false,
		startunbounded: false,
		stop: 20,
		stopinclusive: true,
		stopunbounded: false,
		value: undefined
	}
	expected = ['10 <', '<= 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	//displays 10 < x <= 20
	userInput = '10 <= x <= 20'
	inputRange = {
		start: 10,
		startinclusive: true,
		startunbounded: false,
		stop: 20,
		stopinclusive: true,
		stopunbounded: false,
		value: undefined
	}
	expected = ['10 <=', '<= 20']
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		expected,
		`Should return start and stop values for user input: ${userInput}`
	)

	test.end()
})

tape('setStartStopDisplays with a scaleFactor', test => {
	test.timeoutAfter(100)

	/* a term with valueConversion{} stores its values in one unit (e.g. day) and is read by users
	in another (e.g. year). the brush drags over the stored values, so only the text written back
	into the <input> is converted */
	const dayToYear = 1 / 365.25
	const range = {
		index: 0,
		start: 3652.5,
		startunbounded: false,
		stop: 25868,
		stopunbounded: false
	}
	const inputRange = {
		start: 3652.5,
		startinclusive: true,
		startunbounded: false,
		stop: 25868,
		stopinclusive: false,
		stopunbounded: false,
		value: undefined
	}

	test.deepEqual(
		setStartStopDisplays(range, inputRange, dayToYear),
		['10 <=', '< 70.82'],
		'Should display a brushed range in the user-facing unit'
	)
	test.deepEqual(
		setStartStopDisplays(range, inputRange),
		['3652.5 <=', '< 25868'],
		'Should display the stored values when no scaleFactor is given, as for an unconverted term'
	)
	test.deepEqual(
		setStartStopDisplays(range, inputRange, 1),
		['3652.5 <=', '< 25868'],
		'Should display the stored values for a scaleFactor of 1'
	)

	// inclusivity comes from the input's range, not from the brushed range, with or without conversion
	test.deepEqual(
		setStartStopDisplays(range, { ...inputRange, startinclusive: false, stopinclusive: true }, dayToYear),
		['10 <', '<= 70.82'],
		'Should take the inclusivity from the input range while converting the brushed values'
	)

	// a brush dragged to an edge leaves the range unbounded on that side, with no value to convert
	test.deepEqual(
		setStartStopDisplays({ ...range, startunbounded: true }, inputRange, dayToYear),
		['', '< 70.82'],
		'Should leave an unbounded start empty rather than convert it'
	)

	test.end()
})
