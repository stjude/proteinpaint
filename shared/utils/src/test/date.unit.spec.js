import tape from 'tape'
import { getDateStrFromNumber, getNumberFromDateStr, getDateFromNumber, getNumberFromDate } from '../terms.js'
import { roundValue } from '../roundValue.js'
/**
 * Tests
 * convert date to number
 * convert number to date
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- date convert specs -***-')
	test.end()
})

tape('convert date to number', function (test) {
	const expected = 2023.496
	const date = new Date(2023, 6, 1) // July 1, 2023
	const num = getNumberFromDate(date)
	test.equal(roundValue(num, 3), expected, `The number for date ${date.toDateString()} should be ${expected}`)

	test.end()
})

tape('convert end of year date to number', function (test) {
	const date = new Date(2016, 11, 31) // December 31, 2016
	const num = getNumberFromDate(date)
	const expected = 2016.997
	test.equal(roundValue(num, 3), expected, `The number for date ${date.toDateString()} should be ${expected}`)

	test.end()
})

tape('convert number to date', function (test) {
	const num = 2023.496
	const date = getDateFromNumber(num)
	const str = date.toDateString()
	const expectedDateStr = new Date(2023, 6, 1).toDateString()
	test.equal(expectedDateStr, str, `The date for number ${num} should be ${expectedDateStr} and  it is ${str}`)
	test.end()
})

tape('convert date str to number', function (test) {
	const str = '2023/07/01'
	const num = getNumberFromDateStr(str)
	const expected = 2023.496
	test.equal(roundValue(num, 3), expected, `The number for date ${str} should be ${expected}`)

	test.end()
})
tape('convert number to date str', function (test) {
	const num = 2023.496
	const str = getDateStrFromNumber(num)
	test.equal(
		str,
		'July 2023',
		`The date for number ${num} should be July 2023, the day is omitted to deidentify the patient`
	)
	test.end()
})
