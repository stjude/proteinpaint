import tape from 'tape'
import { roundValueAuto, roundValue2 } from '../roundValue.js'

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
	test.equal(roundValue2(value), value, `is unchanged`)

	value = 1.2345
	rounded = 1.23
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), rounded, `should return ${rounded}`)

	value = 10549.23556789
	rounded = 1.1e4
	let r2 = 10549
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), r2, `should return ${r2}`)

	value = 1549.23556789
	rounded = 1549.24
	r2 = 1549
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), r2, `should return ${r2}`)

	value = 549.23556789
	rounded = 549.24
	r2 = 549
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), r2, `should return ${r2}`)

	value = -89378.345862
	rounded = -8.9e4
	r2 = -89378
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), r2, `should return ${r2}`)

	value = -0.006
	test.equal(roundValueAuto(value), value, `should return ${value}`)
	test.equal(roundValue2(value), value, `should return ${value}`)

	value = 1000
	test.equal(roundValueAuto(value), value, `should return ${value}`)
	test.equal(roundValue2(value), value, `should return ${value}`)

	value = 1000.1234
	rounded = 1000.12
	r2 = 1000
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), r2, `should return ${r2}`)

	value = -0.0001
	test.equal(roundValueAuto(value), value, `should return ${rounded}`)
	test.equal(roundValue2(value), value, `should return ${value}`)

	value = 0.00001
	test.equal(roundValueAuto(value), value, `should return ${value}`)
	test.equal(roundValue2(value), value, `should return ${value}`)

	value = 0.000056
	rounded = 5.6e-5
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), rounded, `should return ${rounded}`)

	value = 0.0000005
	rounded = 5e-7
	test.equal(roundValueAuto(value), rounded, `should return ${rounded}`)
	test.equal(roundValue2(value), value, `should return ${value}`)

	test.end()
})
