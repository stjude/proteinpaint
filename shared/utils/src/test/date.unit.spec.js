import tape from 'tape'
import { getDateStrFromNumber, getNumberFromDateStr, getDateFromNumber, getNumberFromDate } from '../terms.js'
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
	//2023.5 is the first of July 2023.
	const date = new Date(2023, 6, 1) // July 1, 2023
	const num = getNumberFromDate(date)
	test.equal(num, 2023.5, `The number for date ${date.toDateString()} should be 2023.5`)

	test.end()
})

tape('convert number to date', function (test) {
	const num = 2023.5
	const date = getDateFromNumber(num)
	const str = date.toDateString()
	const expectedDateStr = new Date(2023, 6, 1).toDateString()
	test.equal(expectedDateStr, str, `The date for number ${num} should be ${expectedDateStr} and  it is ${str}`)
	test.end()
})

tape('convert date str to number', function (test) {
	//2023.5 is the first of July 2023.
	const str = '2023-07-01'
	const num = getNumberFromDateStr(str)
	test.equal(num, 2023.5, `The number for date ${str} should be 2023.5`)

	test.end()
})
tape('convert number to date str', function (test) {
	const num = 2023.5
	const str = getDateStrFromNumber(num)
	test.equal(
		str,
		'July 2023',
		`The date for number ${num} should be July 2023, the day is omitted to deidentify the patient`
	)
	test.end()
})
