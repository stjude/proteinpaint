import tape from 'tape'
import { roundValueAuto, roundValue2, decimalPlacesUntilFirstNonZero } from '../roundValue.js'

/**
 * Tests
 * 		roundValueAuto()
 * 		roundValue2()
 * 		decimalPlacesUntilFirstNonZero()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- round value specs -***-')
	test.end()
})

tape('roundValueAuto()', function (test) {
	/** Note: Test messages in the console are slightly different
	 * than actual mock data. Javascript in the browser converts
	 * small numbers into scientific notation. For example a value
	 * of 0.0000005 will appear as 5e-7 in the console.
	 */
	let value, rounded, formatted

	value = 1.23456789e-10
	rounded = 1.2e-10
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)
	value = 1.2345
	rounded = 1.23
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	value = 10549.23556789
	rounded = 10549.24
	formatted = '1.1e+4'
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		formatted,
		`Should return formatted value=${formatted} for input value=${value} when format=true`
	)

	value = 1549.23556789
	rounded = 1549.24
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	value = 549.23556789
	rounded = 549.24
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	value = -89378.345862
	rounded = -89378.35
	formatted = '-8.9e+4'
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		formatted,
		`Should return formatted value=${formatted} for input value=${value} when format=true`
	)

	value = -0.006
	test.equal(roundValueAuto(value), value, `Should return input value=${value} unchanged`)
	test.equal(roundValueAuto(value, true), value, `Should return input value=${value} unchanged when format=true`)

	value = 1000
	test.equal(roundValueAuto(value), value, `Should return input value=${value} unchanged`)
	test.equal(roundValueAuto(value, true), value, `Should return input value=${value} unchanged when format=true`)

	value = 1000.1234
	rounded = 1000.12
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	value = -0.0001
	test.equal(roundValueAuto(value), value, `Should return input value=${value} unchanged`)
	test.equal(roundValueAuto(value, true), value, `Should return input value=${value} unchanged when format=true`)

	value = 0.00001
	test.equal(roundValueAuto(value), value, `Should return input value=${value} unchanged`)
	test.equal(roundValueAuto(value, true), value, `Should return input value=${value} unchanged when format=true`)

	value = 0.000056
	rounded = 5.6e-5
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	value = 0.0000005
	rounded = 5e-7
	test.equal(roundValueAuto(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)
	test.equal(
		roundValueAuto(value, true),
		rounded,
		`Should return rounded value=${rounded} for input value=${value} when format=true`
	)

	test.end()
})

tape('roundValue2()', function (test) {
	let value, rounded

	value = 1.23456789e-10
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	value = 1.2345
	rounded = 1.23
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = 10549.23556789
	rounded = 10549
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = 1549.23556789
	rounded = 1549
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = 549.23556789
	rounded = 549
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = -89378.345862
	rounded = -89378
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = -0.006
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	value = 1000
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	value = 1000.1234
	rounded = 1000
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = -0.0001
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	value = 0.00001
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	value = 0.000056
	rounded = 5.6e-5
	test.equal(roundValue2(value), rounded, `Should return rounded value=${rounded} for input value=${value}`)

	value = 0.0000005
	rounded = 5e-7
	test.equal(roundValue2(value), value, `Should return input value=${value} unchanged`)

	test.end()
})

tape('decimalPlacesUntilFirstNonZero()', function (test) {
	/**
	 * Tests for decimalPlacesUntilFirstNonZero function
	 *
	 * Tests the function that counts decimal places until the first non-zero digit after the decimal point.
	 * Edge cases tested:
	 * - Values with 1-4 leading zeros after decimal (0.0001234 -> 0.1234)
	 * - Integers and whole numbers (0, 123, 123.0)
	 * - Negative numbers (-1245, -0.00123)
	 * - Large numbers with decimals (999999.00123)
	 * - Numbers that convert to scientific notation (0.0000005, Number.MIN_VALUE)
	 * - Special values (Infinity, NaN)
	 *
	 * Returns:
	 * - 0 for integers, numbers ≥ 1, scientific notation, special values
	 * - Count of zeros for reaching a non-zero digit otherwise
	 */
	let value, decimalPlaces
	value = 0.0001234
	decimalPlaces = 3
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = 0.001234
	decimalPlaces = 2
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = 0.01234
	decimalPlaces = 1
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = 0.1234
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = 1.234
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = 0.0000005
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value} because Javacscript converts small numbers to scientific notation`
	)

	value = 0
	decimalPlaces = 0
	test.equal(decimalPlacesUntilFirstNonZero(value), decimalPlaces, `Should return 0 for input value=${value}`)

	value = -1245
	decimalPlaces = 0
	test.equal(decimalPlacesUntilFirstNonZero(value), decimalPlaces, `Should return 0 for input value=${value}`)

	value = 123
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return 0 for input value=${value} (number ending in decimal point)`
	)

	value = 123.0
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return 0 for input value=${value} (trailing zeros after decimal)`
	)

	value = -0.00123
	decimalPlaces = 2
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for negative input value=${value}`
	)

	value = 999999.00123
	decimalPlaces = 2
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for large number with decimals value=${value}`
	)

	value = 1.02
	decimalPlaces = 1
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return ${decimalPlaces} for input value=${value}`
	)

	value = Infinity
	decimalPlaces = 0
	test.equal(decimalPlacesUntilFirstNonZero(value), decimalPlaces, `Should return 0 for Infinity`)

	value = NaN
	decimalPlaces = 0
	test.equal(decimalPlacesUntilFirstNonZero(value), decimalPlaces, `Should return 0 for NaN`)

	value = Number.MIN_VALUE
	decimalPlaces = 0
	test.equal(
		decimalPlacesUntilFirstNonZero(value),
		decimalPlaces,
		`Should return 0 for minimum value (will be in scientific notation)`
	)

	test.end()
})
