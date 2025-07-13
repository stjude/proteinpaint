import tape from 'tape'
import initBinConfig from '../termdb.initbinconfig'

/**************
 Test sections
***************/
tape('\n', function (test) {
	test.comment('-***- termdb init bin config specs -***-')
	test.end()
})

tape('integers: round to nearest ones', function (test) {
	const input = [23, 26, 28, 37, 33, 44, 41, 49, 53, 55]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 5,
			first_bin: { stop: 25 }
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: round to nearest tens', function (test) {
	const input = [12, 15, 26, 47, 42, 61, 94, 77, 107, 120]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 10,
			first_bin: { stop: 50 }
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: round to nearest hundreds', function (test) {
	const input = [362, 391, 213, 841, 247, 538, 1004, 692, 436, 951]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 100,
			first_bin: { stop: 300 },
			last_bin: { start: 900 }
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: single unique value (0)', function (test) {
	const input = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'custom-bin',
			lst: [
				{ stop: 0, stopinclusive: false, startunbounded: true, label: '<' + 0 },
				{ start: 0, stop: 0, startinclusive: true, stopinclusive: true, label: '=' + 0 },
				{ start: 0, startinclusive: false, stopunbounded: true, label: '>' + 0 }
			]
		},
		'should match expected output'
	)
	test.end()
})

tape('integers: single unique value (3)', function (test) {
	const input = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'custom-bin',
			lst: [
				{ stop: 3, stopinclusive: false, startunbounded: true, label: '<' + 3 },
				{ start: 3, stop: 3, startinclusive: true, stopinclusive: true, label: '=' + 3 },
				{ start: 3, startinclusive: false, stopunbounded: true, label: '>' + 3 }
			]
		},
		'should match expected output'
	)
	test.end()
})

tape('fractions: round to nearest tenths', function (test) {
	const input = [0.715, 0.423, 0.417, 0.152, 0.836, 1.672, 1.291, 0.371, 2.357, 0.263]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 0.3,
			first_bin: { stop: 0.4 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})

tape('fractions: round to nearest hundredths', function (test) {
	const input = [0.715, 0.413, 0.025, 0.147, 0.072, 0.945, 0.036, 0.371, 0.831, 0.263]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 0.1,
			first_bin: { stop: 0.1 },
			last_bin: { start: 0.7 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})

tape('floats greater than 1', function (test) {
	const input = [58.3157, 76.3912, 24.5121, 27.1343, 89.4312, 77.2327, 51.6689, 43.7342, 34.5281, 37.8262]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 10,
			first_bin: { stop: 35 }
		},
		'should match expected output'
	)
	test.end()
})

tape('floats: single unique value (8.2317)', function (test) {
	const input = [8.2317, 8.2317, 8.2317, 8.2317, 8.2317, 8.2317, 8.2317, 8.2317, 8.2317, 8.2317]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'custom-bin',
			lst: [
				{ stop: 8.2317, stopinclusive: false, startunbounded: true, label: '<' + 8.2317 },
				{ start: 8.2317, stop: 8.2317, startinclusive: true, stopinclusive: true, label: '=' + 8.2317 },
				{ start: 8.2317, startinclusive: false, stopunbounded: true, label: '>' + 8.2317 }
			]
		},
		'should match expected output'
	)
	test.end()
})

tape('negative integers', function (test) {
	const input = [10, 16, -12, -3, 5, -7, 2, 9, 4, -1]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 5,
			first_bin: { stop: -10 }
		},
		'should match expected output'
	)
	test.end()
})

tape('negative fractions', function (test) {
	const input = [-0.4, 0.6, -0.7, 1.5, 1.1, -0.2, 0.1, 1.3, -0.3, 0.8]
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 0.3,
			first_bin: { stop: -0.4 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})

tape('JSON string output', function (test) {
	const input = [23, 26, 28, 37, 33, 44, 41, 49, 53, 55]
	const output = initBinConfig(input, { format: 'string' })
	test.equal(
		output,
		'{"type":"regular-bin","startinclusive":true,"bin_size":5,"first_bin":{"stop":25}}',
		'should match expected output'
	)
	test.end()
})

tape('large test data: integers', function (test) {
	const input = []
	// mimic data from an actual variable
	for (let i = 0; i < 200; i++) input.push(0)
	for (let i = 0; i < 300; i++) input.push(1)
	for (let i = 0; i < 200; i++) input.push(2)
	for (let i = 0; i < 100; i++) input.push(3)
	for (let i = 0; i < 90; i++) input.push(4)
	for (let i = 0; i < 80; i++) input.push(5)
	for (let i = 0; i < 70; i++) input.push(6)
	for (let i = 0; i < 60; i++) input.push(7)
	for (let i = 0; i < 50; i++) input.push(8)
	for (let i = 0; i < 40; i++) input.push(9)
	input.push(...[10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 13, 13, 14, 15, 18, 22])
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 1,
			first_bin: { stop: 1 },
			last_bin: { start: 7 }
		},
		'should match expected output'
	)
	test.end()
})

tape('large test data: floats', function (test) {
	const input = []
	// mimic data from an actual variable
	for (let i = 0; i < 300; i++) input.push(0)
	for (let i = 0; i < 100; i++) input.push(0.00804)
	for (let i = 0; i < 100; i++) input.push(0.0159)
	for (let i = 0; i < 200; i++) input.push(0.016)
	for (let i = 0; i < 90; i++) input.push(0.0163)
	for (let i = 0; i < 70; i++) input.push(0.0324)
	for (let i = 0; i < 60; i++) input.push(0.149)
	for (let i = 0; i < 50; i++) input.push(0.423)
	for (let i = 0; i < 40; i++) input.push(0.809)
	for (let i = 0; i < 20; i++) input.push(1.07)
	for (let i = 0; i < 20; i++) input.push(1.56)
	for (let i = 0; i < 10; i++) input.push(2.14)
	for (let i = 0; i < 10; i++) input.push(3.8)
	const output = initBinConfig(input)
	test.deepEqual(
		output,
		{
			type: 'regular-bin',
			startinclusive: true,
			bin_size: 0.2,
			first_bin: { stop: 0.2 },
			last_bin: { start: 1.4 },
			rounding: '.1f'
		},
		'should match expected output'
	)
	test.end()
})
