import tape from 'tape'
import { roundValueAuto, roundValue2 } from '../roundValue.js'

/**
 * Tests
 * 		roundValueAuto()
 * 		roundValue2()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- round value specs -***-')
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
