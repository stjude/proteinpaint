import tape from 'tape'
import * as d3s from 'd3-selection'
import { parseRange, NumericRangeInput } from '../numericRangeInput'

function getHolder() {
	return d3s.select('body').append('div').style('padding', '5px').style('margin', '5px')
}

/**
 * Test Suite: parseRange()
 *
 * This suite verifies the parseRange function which parses string expressions
 * representing numeric ranges and equality statements. The function handles:
 * - Exact value expressions (e.g., "x = 5" or "5 = x")
 * - Inclusive/exclusive ranges (e.g., "5 <= x <= 10" or "5 < x < 10")
 * - Mixed inclusive/exclusive ranges (e.g., "5 <= x < 10")
 * - Unbounded ranges (e.g., "x <= 10")
 *
 * The suite is organized into several sections:
 * 1. Basic functionality (exact values and ranges)
 * 2. Input variations (decimals, negatives, spacing)
 * 3. Edge cases and boundaries
 * 4. Error handling
 * 5. Property verification
 */

/**
 * Test Coverage Notes:
 * This suite aims for comprehensive coverage of:
 * - All input formats (equality, ranges)
 * - All boundary conditions (inclusive/exclusive)
 * - All edge cases (zero, MAX_SAFE_INTEGER, MIN_SAFE_INTEGER)
 * - All error conditions
 * - All whitespace variations
 */

/**
 * Input/Output Patterns:
 * Input: String in one of these formats:
 * - "x = value" or "value = x" (equality)
 * - "start <= x <= stop" (inclusive range)
 * - "start < x < stop" (exclusive range)
 * - "start <= x < stop" (mixed range)
 * - "x <= stop" or "x < stop" (unbounded range)
 *
 * Output: Object with properties:
 * - value: number (for equality)
 * - start: number (for ranges)
 * - stop: number (for ranges)
 * - startinclusive: boolean
 * - stopinclusive: boolean
 * - startunbounded: boolean
 * - stopunbounded: boolean
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- numericRangeInput specs -***-')
	test.end()
})

/**********************
 * Basic Value Tests *
 **********************/
tape('parseRange function', function (test) {
	test.timeoutAfter(500)
	// Testing exact value inputs - checks both possible formats
	test.test('handles exact value input', function (test) {
		// First format: "x = value"
		const result1 = parseRange('x = 5')
		test.deepEqual(
			result1,
			{
				value: 5,
				label: 'x = 5'
			},
			'correctly parses "x = 5" format'
		)

		// Second format: "value = x"
		const result2 = parseRange('5 = x')
		test.deepEqual(
			result2,
			{
				value: 5,
				label: 'x = 5'
			},
			'correctly parses "5 = x" format'
		)
		test.end()
	})

	/**
	 * Tests inclusive range notation
	 * Verifies handling of:
	 * - Fully bounded ranges with inclusive bounds
	 * - Unbounded ranges (missing start value)
	 * All cases should correctly set inclusivity flags
	 */

	// Testing inclusive range notation (using <= operators)
	test.test('handles inclusive range inputs', function (test) {
		// Testing bounded range with both start and stop
		const result1 = parseRange('5 <= x <= 10')
		test.deepEqual(
			result1,
			{
				start: 5,
				stop: 10,
				value: undefined,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly parses bounded inclusive range'
		)

		// Testing unbounded range with only stop value
		const result2 = parseRange('x <= 10')
		test.deepEqual(
			result2,
			{
				start: undefined,
				stop: 10,
				value: undefined,
				startinclusive: undefined,
				stopinclusive: true,
				startunbounded: true,
				stopunbounded: false
			},
			'correctly parses unbounded inclusive range'
		)
		test.end()
	})

	/**
	 * Tests exclusive range notation
	 * Verifies proper handling of:
	 * - Fully bounded ranges with exclusive bounds
	 * - Correct setting of inclusivity flags
	 * - Proper numeric parsing with exclusive bounds
	 */

	// Testing exclusive range notation (using < operators)
	test.test('handles exclusive range inputs', function (test) {
		const result = parseRange('5 < x < 10')
		test.deepEqual(
			result,
			{
				start: 5,
				stop: 10,
				value: undefined,
				startinclusive: false,
				stopinclusive: false,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly parses exclusive range'
		)
		test.end()
	})

	/**
	 * Tests mixed inclusive/exclusive range notation
	 * Verifies proper handling of:
	 * - Combinations of inclusive and exclusive bounds
	 * - Correct setting of different inclusivity flags for start and stop
	 * - Proper interpretation of mixed boundary conditions
	 */

	// Testing mixed inclusive/exclusive notation
	test.test('handles mixed inclusive/exclusive range inputs', function (test) {
		const result = parseRange('5 <= x < 10')
		test.deepEqual(
			result,
			{
				start: 5,
				stop: 10,
				value: undefined,
				startinclusive: true,
				stopinclusive: false,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly parses mixed inclusive/exclusive range'
		)
		test.end()
	})

	// Testing various error cases
	test.test('handles error cases appropriately', function (test) {
		// Testing malformed input
		test.throws(
			function () {
				parseRange('invalid input')
			},
			/Could not parse expression/,
			'throws appropriate error for invalid expression format'
		)
		test.end()
	})

	// Testing decimal number handling
	test.test('handles decimal numbers', function (test) {
		const result = parseRange('5.5 <= x <= 10.5')
		test.deepEqual(
			result,
			{
				start: 5.5,
				stop: 10.5,
				value: undefined,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly parses decimal numbers'
		)
		test.end()
	})

	// Testing negative number handling
	test.test('handles negative numbers', function (test) {
		const result = parseRange('-5 <= x <= -2')
		test.deepEqual(
			result,
			{
				start: -5,
				stop: -2,
				value: undefined,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly parses negative numbers'
		)
		test.end()
	})

	/*************************
	 * Input Variation Tests *
	 *************************/

	/**
	 * Tests whitespace handling and input normalization
	 * Verifies that the parser is resilient to:
	 * - Different spacing patterns
	 * - Leading/trailing whitespace
	 * - Missing spaces between operators
	 * This ensures consistent parsing regardless of input formatting
	 */
	test.test('handles input normalization', function (test) {
		// Testing various whitespace patterns
		const results = [
			parseRange('5<=x<=10'),
			parseRange(' 5 <= x <= 10 '),
			parseRange('5   <=    x    <=   10'),
			parseRange('   5<=x<=10   ')
		]

		const expected = {
			start: 5,
			stop: 10,
			value: undefined,
			startinclusive: true,
			stopinclusive: true,
			startunbounded: false,
			stopunbounded: false
		}

		results.forEach((result, index) => {
			test.deepEqual(result, expected, `correctly normalizes whitespace pattern ${index + 1}`)
		})

		test.end()
	})

	/***********************
	 * Edge Case Tests     *
	 ***********************/

	/**
	 * Tests boundary value handling
	 * Verifies proper handling of:
	 * - Zero values (which can be tricky in comparisons)
	 * - Maximum safe integers (to avoid overflow issues)
	 * - Minimum safe integers (to ensure negative bound handling)
	 * These cases test the numerical limits of the parser
	 */
	test.test('handles edge cases', function (test) {
		// Testing zero
		const resultZero = parseRange('0 <= x <= 0')
		test.deepEqual(
			resultZero,
			{
				start: 0,
				stop: 0,
				value: undefined,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			},
			'correctly handles zero bounds'
		)

		test.end()
	})

	/***********************
	 * Error Handler Tests *
	 ***********************/

	/**
	 * Tests error handling capabilities
	 * Verifies appropriate responses to:
	 * - Invalid operators (e.g., '>>')
	 * - Malformed number formats
	 * - Range bound violations
	 * - Invalid variable names
	 * Each error should produce an appropriate, descriptive error message
	 */
	test.test('handles various error cases', function (test) {
		// Testing invalid operators
		test.throws(
			function () {
				parseRange('5 >> x <= 10')
			},
			/Could not parse expression/,
			'rejects invalid operators'
		)

		// Testing invalid number formats
		test.throws(
			function () {
				parseRange('5.5.5 <= x <= 10')
			},
			/Could not parse expression/,
			'rejects malformed numbers'
		)

		// Testing reversed bounds
		test.throws(
			function () {
				parseRange('10 <= x <= 5')
			},
			/start must be lower than stop/,
			'rejects reversed bounds'
		)

		// Testing missing x variable
		test.throws(
			function () {
				parseRange('5 <= y <= 10')
			},
			/Could not parse expression/,
			'rejects expressions without x variable'
		)

		test.end()
	})

	// Testing boundary conditions
	test.test('handles boundary conditions', function (test) {
		// Testing Number.MAX_SAFE_INTEGER
		const maxInt = Number.MAX_SAFE_INTEGER
		const resultMaxInt = parseRange(`${maxInt} = x`)
		test.deepEqual(
			resultMaxInt,
			{
				value: maxInt,
				label: `x = ${maxInt}`
			},
			'correctly handles maximum safe integer'
		)

		// Testing Number.MIN_SAFE_INTEGER
		const minInt = Number.MIN_SAFE_INTEGER
		const resultMinInt = parseRange(`${minInt} = x`)
		test.deepEqual(
			resultMinInt,
			{
				value: minInt,
				label: `x = ${minInt}`
			},
			'correctly handles minimum safe integer'
		)

		test.end()
	})

	/***************************
	 * Property Verifier Tests *
	 ***************************/

	/**
	 *
	 * Tests fundamental properties that must hold true
	 * Verifies:
	 * - Start value is always less than stop value in valid ranges
	 * - Unbounded ranges correctly set undefined values
	 * - Consistent behavior of inclusivity flags
	 * These properties ensure the parsed ranges are logically valid
	 */

	test.test('verifies range properties', function (test) {
		// Testing that start is always less than stop for valid ranges
		const result = parseRange('5 <= x <= 10')
		test.ok(result.start < result.stop, 'ensures range bounds are logically consistent (start < stop)')

		// Testing that unbounded ranges have correct undefined values
		const unboundedResult = parseRange('x <= 10')
		test.equal(unboundedResult.start, undefined, 'ensures unbounded ranges have undefined values set correctly')

		test.end()
	})

	test.end()
})

tape('NumericRangeInput', function (test) {
	test.timeoutAfter(100)
	const holder = getHolder()
	const mockRange = {
		index: 0,
		start: 0,
		startinclusive: true,
		startunbounded: false,
		stop: 0.6,
		stopinclusive: false,
		stopunbounded: false
	}
	const callback = () => {
		//So ts doesn't complain
		console.log('test')
	}

	const input = new NumericRangeInput(holder.append('div') as any, mockRange, callback)

	test.deepEqual(input.getRange(), mockRange, 'Should set range to input')
	test.equal(input.input.node()!.value, `0 <= x <= 0.6`, 'Should return correct string to display in the input box')

	if (test['_ok']) holder.remove()
	test.end()
})
