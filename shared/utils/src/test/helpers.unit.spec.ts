import tape from 'tape'
import { convertUnits, getValueConversionFactor, toUserUnit, toStoredUnit } from '../helpers.js'

/*
Tests the term.valueConversion{} helpers

	getValueConversionFactor()
	toUserUnit()
	toStoredUnit()
	convertUnits()

a term with valueConversion{} stores its values in .fromUnit (e.g. day) and shows them to users in
.toUnit (e.g. year). anything persisted -- bin boundaries, tvs ranges, spline knots -- stays in the
stored unit, so every ui that shows an editable number crosses that boundary twice, and a mix-up
silently rewrites a saved q. these specs pin both directions and the loss of the round trip
*/

// gdc "age at diagnosis": stored in days, read in years
const dayToYear = { fromUnit: 'day', toUnit: 'year', scaleFactor: 1 / 365.25 }
const ageTerm = { name: 'age at diagnosis', type: 'integer', valueConversion: dayToYear }
const plainTerm = { name: 'age (years)', type: 'integer' }

function closeTo(test, actual, expected, eps, msg) {
	test.true(Math.abs(actual - expected) <= eps, `${msg} (got ${actual}, expected ${expected} +/- ${eps})`)
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- valueConversion helpers specs -***-')
	test.end()
})

tape('getValueConversionFactor()', function (test) {
	test.equal(getValueConversionFactor(ageTerm), 1 / 365.25, 'Should return the scaleFactor of a converted term')

	// callers multiply unconditionally, so anything unusable must fall back to 1 and not to 0/NaN,
	// which would collapse a scale domain or blank out an input
	test.equal(getValueConversionFactor(plainTerm), 1, 'Should return 1 for a term without valueConversion')
	test.equal(getValueConversionFactor(undefined), 1, 'Should return 1 for a missing term')
	test.equal(getValueConversionFactor(null), 1, 'Should return 1 for a null term')
	test.equal(getValueConversionFactor({}), 1, 'Should return 1 for an empty term')
	test.equal(
		getValueConversionFactor({ valueConversion: {} }),
		1,
		'Should return 1 for a valueConversion without a scaleFactor'
	)
	test.equal(getValueConversionFactor({ valueConversion: { scaleFactor: 0 } }), 1, 'Should return 1 for scaleFactor=0')
	test.equal(
		getValueConversionFactor({ valueConversion: { scaleFactor: -2 } }),
		1,
		'Should return 1 for a negative scaleFactor'
	)
	test.equal(
		getValueConversionFactor({ valueConversion: { scaleFactor: 'abc' } }),
		1,
		'Should return 1 for a non-numeric scaleFactor'
	)
	test.equal(
		getValueConversionFactor({ valueConversion: { scaleFactor: NaN } }),
		1,
		'Should return 1 for a NaN scaleFactor'
	)
	test.equal(
		getValueConversionFactor({ valueConversion: { scaleFactor: Infinity } }),
		1,
		'Should return 1 for an infinite scaleFactor'
	)
	// a dataset may supply the factor as a string, as json config often does
	test.equal(
		getValueConversionFactor({ valueConversion: { scaleFactor: '0.0027397260273972603' } }),
		0.0027397260273972603,
		'Should cast a numeric string scaleFactor'
	)

	test.end()
})

tape('toUserUnit()', function (test) {
	test.equal(toUserUnit(25868, ageTerm), 70.82, 'Should convert a stored value to the user-facing unit')
	test.equal(toUserUnit(0, ageTerm), 0, 'Should convert zero rather than treat it as a blank input')
	test.equal(toUserUnit(-3652.5, ageTerm), -10, 'Should convert a negative value')
	test.equal(toUserUnit('25868', ageTerm), 70.82, 'Should cast a numeric string')

	// the default rounding is what makes the round trip lossy, so pin it and the override
	test.equal(toUserUnit(25868, ageTerm), 70.82, 'Should round to 2 decimals by default')
	test.equal(toUserUnit(25868, ageTerm, 0), 71, 'Should round to whole numbers when digits=0')
	test.equal(toUserUnit(25868, ageTerm, 4), 70.8227, 'Should round to 4 decimals when digits=4')

	// an unusable value is handed back untouched, so that a caller's own handling of it (an empty
	// <input>, an unbounded bin edge) is not silently turned into 0 or NaN
	test.equal(toUserUnit('', ageTerm), '', 'Should return an empty string untouched')
	test.equal(toUserUnit(null, ageTerm), null, 'Should return null untouched')
	test.equal(toUserUnit(undefined, ageTerm), undefined, 'Should return undefined untouched')
	test.equal(toUserUnit('abc', ageTerm), 'abc', 'Should return a non-numeric string untouched')
	test.true(Number.isNaN(toUserUnit(NaN, ageTerm)), 'Should return NaN untouched')
	test.equal(toUserUnit(Infinity, ageTerm), Infinity, 'Should return an infinite value untouched')

	// with no conversion the value must come back byte for byte, since every caller applies these
	// helpers unconditionally and most terms have no valueConversion
	test.equal(toUserUnit(25868, plainTerm), 25868, 'Should return the value unchanged for an unconverted term')
	test.equal(toUserUnit('25868', plainTerm), '25868', 'Should not cast a string for an unconverted term')
	test.equal(toUserUnit(25868, undefined), 25868, 'Should return the value unchanged for a missing term')

	test.end()
})

tape('toStoredUnit()', function (test) {
	closeTo(test, toStoredUnit(70.82, ageTerm), 25867.005, 1e-6, 'Should convert a typed value back to the stored unit')
	test.equal(toStoredUnit(0, ageTerm), 0, 'Should convert zero rather than treat it as a blank input')
	closeTo(test, toStoredUnit(-10, ageTerm), -3652.5, 1e-6, 'Should convert a negative value')
	closeTo(test, toStoredUnit('70.82', ageTerm), 25867.005, 1e-6, 'Should cast a numeric string')

	test.equal(toStoredUnit('', ageTerm), '', 'Should return an empty string untouched')
	test.equal(toStoredUnit(null, ageTerm), null, 'Should return null untouched')
	test.equal(toStoredUnit(undefined, ageTerm), undefined, 'Should return undefined untouched')
	test.equal(toStoredUnit('abc', ageTerm), 'abc', 'Should return a non-numeric string untouched')

	test.equal(toStoredUnit(25868, plainTerm), 25868, 'Should return the value unchanged for an unconverted term')
	test.equal(toStoredUnit('25868', plainTerm), '25868', 'Should not cast a string for an unconverted term')

	test.end()
})

tape('toUserUnit()/toStoredUnit() round trip', function (test) {
	/* a ui fills an input with toUserUnit() and reads it back with toStoredUnit(), so a value
	survives an edit menu being opened and applied without a change. only toUserUnit() rounds, so
	the loss is bounded by half of the last shown digit, stated in the stored unit */
	const digits = 2
	const maxLoss = 0.5 * Math.pow(10, -digits) * 365.25 // 1.83 days

	for (const v of [0, 1, 365, 3652.5, 10950, 21900, 25868, -25868]) {
		const back = toStoredUnit(toUserUnit(v, ageTerm), ageTerm)
		closeTo(test, back, v, maxLoss, `Should return ${v} within the rounding loss of a round trip`)
	}

	// re-opening the same menu must not walk the value further each time
	let v: any = 25868
	const first = toStoredUnit(toUserUnit(v, ageTerm), ageTerm)
	for (let i = 0; i < 5; i++) v = toStoredUnit(toUserUnit(v, ageTerm), ageTerm)
	closeTo(test, v, first, 1e-6, 'Should not drift further over repeated round trips')

	// more digits, less loss
	closeTo(
		test,
		toStoredUnit(toUserUnit(25868, ageTerm, 6), ageTerm),
		25868,
		0.5 * Math.pow(10, -6) * 365.25,
		'Should lose less when more digits are shown'
	)

	test.end()
})

tape('convertUnits()', function (test) {
	/* formats a value for reading, e.g. as a bin label. get_bin_label() calls it with compact=true,
	so that is the form a converted bin label is made of */
	const { fromUnit, toUnit, scaleFactor } = dayToYear

	test.equal(
		convertUnits(25868, fromUnit, toUnit, scaleFactor, true),
		'70y301d',
		'Should state the remainder in the stored unit, compact'
	)
	test.equal(
		convertUnits(25868, fromUnit, toUnit, scaleFactor),
		'70 years 301 days',
		'Should state the remainder in the stored unit'
	)
	test.equal(convertUnits(730.5, fromUnit, toUnit, scaleFactor, true), '2y', 'Should drop a zero remainder, compact')
	test.equal(convertUnits(730.5, fromUnit, toUnit, scaleFactor), '2 years', 'Should drop a zero remainder')
	test.equal(
		convertUnits(300, fromUnit, toUnit, scaleFactor, true),
		'0y300d',
		'Should keep a zero converted value, compact'
	)

	// scaleFactor >= 1 is the other direction, e.g. years to months, and has no remainder
	test.equal(convertUnits(3, 'year', 'month', 12, true), '36m', 'Should convert upward, compact')
	test.equal(convertUnits(3, 'year', 'month', 12), '36 months', 'Should convert upward')

	/* the long form pluralizes off `> 1`, so a value of exactly 0 or 1 toUnit is labeled with no
	unit at all. this is a rough edge of the existing formatter, pinned here so that fixing it is a
	deliberate change; the compact form used by bin labels is unaffected */
	test.equal(convertUnits(365.25, fromUnit, toUnit, scaleFactor), '1 ', 'Should label exactly 1 year without a unit')
	test.equal(convertUnits(0, fromUnit, toUnit, scaleFactor), '0 ', 'Should label 0 without a unit')
	test.equal(convertUnits(365.25, fromUnit, toUnit, scaleFactor, true), '1y', 'Should label exactly 1 year, compact')

	test.end()
})
