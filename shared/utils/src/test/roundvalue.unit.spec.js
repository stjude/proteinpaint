import tape from 'tape'
import { roundValueAuto } from '../roundValue.js'

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- round value specs -***-')
	test.end()
})

tape('roundValue tests', function (test) {
	let value = 1.23456789e-10
	let rounded = 1.2e-10
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 1.2345
	rounded = 1.23
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 0.000056
	rounded = 5.6e-5
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 10549.23556789
	rounded = '1.1e+4'
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = -0.006
	rounded = -0.006
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 1000
	rounded = 1000
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 1000.123
	rounded = 1000.12
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = -0.0001
	rounded = -0.0001
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	value = 0.00001
	rounded = 0.00001
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	//JavaScript represents numbers smaller than 1e-6 in scientific notation
	value = 0.0000005
	rounded = 5e-7
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)

	test.end()
})
