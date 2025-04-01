import tape from 'tape'
import { roundValueAuto, roundValue2, decimalPlacesUntilFirstNonZero } from '../roundValue.js'
import { getDateStrFromNumber, getNumberFromDateStr } from '../terms.js'
/**
 * Tests
 * convert date to number
 * convert number to date
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- date convert specs -***-')
	test.end()
})

tape('conver date to number', function (test) {
	//2023.5 is the first of July 2023.
	const str = '2023-07-01'
	const num = getNumberFromDateStr(str)
	test.equal(num, 2023.5, `The number for date ${str} should be 2023.5`)

	test.end()
})
tape('convert number to date', function (test) {
	const num = 2023.5
	const str = getDateStrFromNumber(num)
	test.equal(str, 'July 2023', `The date for number ${num} should be July 2023, the day is omitted`)
	test.end()
})
