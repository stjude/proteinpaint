const tape = require('tape')
const initBinConfig = require('../termdb.initbinconfig')

/**************
 Test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb init bin config specs -***-')
	test.end()
})

tape('integers: round to nearest ones', function(test) {
	const input = [23, 26, 28, 37, 33, 44, 41, 49, 53, 55]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 4,
			first_bin: { stop: 23 },
			last_bin: { start: 47 }
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: round to nearest tens', function(test) {
	const input = [12, 15, 26, 47, 42, 61, 94, 77, 107, 120]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 10,
			first_bin: { stop: 10 },
			last_bin: { start: 70 }
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: round to nearest hundreds', function(test) {
	const input = [362, 391, 213, 841, 247, 538, 1004, 692, 436, 951]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 100,
			first_bin: { stop: 200 },
			last_bin: { start: 800 }
		},
		'should match expected output'
	)
	test.end()
})

tape('fractions: round to nearest tenths', function(test) {
	const input = [0.715, 0.423, 0.417, 0.152, 0.836, 1.672, 1.291, 0.371, 2.357, 0.263]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 0.3,
			first_bin: { stop: 0.2 },
			last_bin: { start: 2 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})

tape('fractions: round to nearest hundredths', function(test) {
	const input = [0.715, 0.413, 0.025, 0.147, 0.072, 0.945, 0.036, 0.371, 0.831, 0.263]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 0.1,
			first_bin: { stop: 0.03 },
			last_bin: { start: 0.63 },
			rounding: '.2f'
		},
		'should match expected output'
	)
	test.end()
})

tape('floats greater than 1', function(test) {
	const input = [58.3157, 76.3912, 24.5121, 27.1343, 89.4312, 77.2327, 51.6689, 43.7342, 34.5281, 37.8262]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 8,
			first_bin: { stop: 25 },
			last_bin: { start: 73 }
		},
		'should match expected output'
	)
	test.end()
})

tape('negative integers', function(test) {
	const input = [10, 16, -12, -3, 5, -7, 2, 9, 4, -1]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 4,
			first_bin: { stop: -12 }
		},
		'should match expected output'
	)
	test.end()
})

tape('negative fractions', function(test) {
	const input = [-0.4, 0.6, -0.7, 1.5, 1.1, -0.2, 0.1, 1.3, -0.3, 0.8]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular',
			startinclusive: true,
			bin_size: 0.3,
			first_bin: { stop: -0.7 },
			last_bin: { start: 1.1 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})

tape('JSON string output', function(test) {
	const input = [23, 26, 28, 37, 33, 44, 41, 49, 53, 55]
	const output = initBinConfig(input, { format: 'string' })
	test.equal(
		output,
		'{"type":"regular","startinclusive":true,"bin_size":4,"first_bin":{"stop":23},"last_bin":{"start":47}}',
		'should match expected output'
	)
	test.end()
})
