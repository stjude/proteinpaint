/********************************************
Test script for 'rust/src/fisher.rs'

Run test script as follows (from 'proteinpaint/'):

    node rust/test/fisherTest.js

*********************************************/

const tape = require('tape')
const run_rust = require('@stjude/proteinpaint-rust').run_rust

// Chi-squared test
tape('test #1', async function(test) {
	const input = [
		{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895 },
		{ index: 1, n1: 407, n2: 2248, n3: 329, n4: 2069 },
		{ index: 2, n1: 1047, n2: 1351, n3: 1083, n4: 1572 }
	]

	const output = await run_rust('fisher', JSON.stringify({ fisher_limit: 1000, individual_fisher_limit: 150, input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895, p_value: 0.1201870950989139 },
			{ index: 1, n1: 407, n2: 2248, n3: 329, n4: 2069, p_value: 0.10526546766901224 },
			{ index: 2, n1: 1047, n2: 1351, n3: 1083, n4: 1572, p_value: 0.03907918497577101 }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test
tape('test #2', async function(test) {
	const input = [
		{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ fisher_limit: 1000, individual_fisher_limit: 150, input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32, p_value: 0.4285714285714324 },
			{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15, p_value: 0.7765396747006522 },
			{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16, p_value: 0.5813323604231644 }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test and chi-square test
tape('test #3', async function(test) {
	const input = [
		{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ fisher_limit: 20, individual_fisher_limit: 5, input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32, p_value: 0.4285714285714324 },
			{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15, p_value: 0.6249468134880591 },
			{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16, p_value: 0.42960690941598956 }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

// Chi-squared test with FDR
tape('test #4', async function(test) {
	const input = [
		{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895 },
		{ index: 1, n1: 503, n2: 1895, n3: 605, n4: 2050 },
		{ index: 2, n1: 407, n2: 2248, n3: 329, n4: 2069 },
		{ index: 3, n1: 329, n2: 2069, n3: 407, n4: 2248 },
		{ index: 4, n1: 1047, n2: 1351, n3: 1083, n4: 1572 },
		{ index: 5, n1: 1083, n2: 1572, n3: 1047, n4: 1351 },
		{ index: 6, n1: 537, n2: 2118, n3: 501, n4: 1897 },
		{ index: 7, n1: 501, n2: 1897, n3: 537, n4: 2118 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		JSON.stringify([
			{
				index: 0,
				n1: 605,
				n2: 2050,
				n3: 503,
				n4: 1895,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.16024946013188518
			},
			{
				index: 1,
				n1: 503,
				n2: 1895,
				n3: 605,
				n4: 2050,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.16024946013188518
			},
			{
				index: 2,
				n1: 407,
				n2: 2248,
				n3: 329,
				n4: 2069,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518
			},
			{
				index: 3,
				n1: 329,
				n2: 2069,
				n3: 407,
				n4: 2248,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518
			},
			{
				index: 4,
				n1: 1047,
				n2: 1351,
				n3: 1083,
				n4: 1572,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403
			},
			{
				index: 5,
				n1: 1083,
				n2: 1572,
				n3: 1047,
				n4: 1351,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403
			},
			{
				index: 6,
				n1: 537,
				n2: 2118,
				n3: 501,
				n4: 1897,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514
			},
			{
				index: 7,
				n1: 501,
				n2: 1897,
				n3: 537,
				n4: 2118,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514
			}
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test with FDR
tape('test #5', async function(test) {
	const input = [
		{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32 },
		{ index: 1, n1: 3, n2: 29, n3: 3, n4: 21 },
		{ index: 2, n1: 3, n2: 21, n3: 3, n4: 29 },
		{ index: 3, n1: 5, n2: 27, n3: 3, n4: 21 },
		{ index: 4, n1: 3, n2: 21, n3: 5, n4: 27 },
		{ index: 5, n1: 9, n2: 15, n3: 10, n4: 22 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 },
		{ index: 8, n1: 8, n2: 16, n3: 14, n4: 18 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		'[{"index":0,"n1":1,"n2":23,"n3":0,"n4":32,"p_value":0.4285714285714324,"adjusted_p_value":1.0},' +
			'{"index":1,"n1":3,"n2":29,"n3":3,"n4":21,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":2,"n1":3,"n2":21,"n3":3,"n4":29,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":3,"n1":5,"n2":27,"n3":3,"n4":21,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":4,"n1":3,"n2":21,"n3":5,"n4":27,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":5,"n1":9,"n2":15,"n3":10,"n4":22,"p_value":0.7765396747006506,"adjusted_p_value":1.0},' +
			'{"index":6,"n1":10,"n2":22,"n3":9,"n4":15,"p_value":0.7765396747006522,"adjusted_p_value":1.0},' +
			'{"index":7,"n1":14,"n2":18,"n3":8,"n4":16,"p_value":0.5813323604231644,"adjusted_p_value":1.0},' +
			'{"index":8,"n1":8,"n2":16,"n3":14,"n4":18,"p_value":0.5813323604231715,"adjusted_p_value":1.0}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test and chi-square test with FDR
tape('test #6', async function(test) {
	const input = [
		{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895 },
		{ index: 1, n1: 503, n2: 1895, n3: 605, n4: 2050 },
		{ index: 2, n1: 407, n2: 2248, n3: 329, n4: 2069 },
		{ index: 3, n1: 329, n2: 2069, n3: 407, n4: 2248 },
		{ index: 4, n1: 1047, n2: 1351, n3: 1083, n4: 1572 },
		{ index: 5, n1: 1083, n2: 1572, n3: 1047, n4: 1351 },
		{ index: 6, n1: 537, n2: 2118, n3: 501, n4: 1897 },
		{ index: 7, n1: 501, n2: 1897, n3: 537, n4: 2118 },
		{ index: 8, n1: 18, n2: 2380, n3: 23, n4: 2632 },
		{ index: 9, n1: 23, n2: 2632, n3: 18, n4: 2380 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		JSON.stringify([
			{
				index: 0,
				n1: 605,
				n2: 2050,
				n3: 503,
				n4: 1895,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.20031182516485652
			},
			{
				index: 1,
				n1: 503,
				n2: 1895,
				n3: 605,
				n4: 2050,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.20031182516485652
			},
			{
				index: 2,
				n1: 407,
				n2: 2248,
				n3: 329,
				n4: 2069,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.20031182516485652
			},
			{
				index: 3,
				n1: 329,
				n2: 2069,
				n3: 407,
				n4: 2248,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.20031182516485652
			},
			{
				index: 4,
				n1: 1047,
				n2: 1351,
				n3: 1083,
				n4: 1572,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.19539592487885504
			},
			{
				index: 5,
				n1: 1083,
				n2: 1572,
				n3: 1047,
				n4: 1351,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.19539592487885504
			},
			{
				index: 6,
				n1: 537,
				n2: 2118,
				n3: 501,
				n4: 1897,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.6977505902491893
			},
			{
				index: 7,
				n1: 501,
				n2: 1897,
				n3: 537,
				n4: 2118,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.6977505902491893
			},
			{
				index: 8,
				n1: 18,
				n2: 2380,
				n3: 23,
				n4: 2632,
				p_value: 0.7539932745346816,
				adjusted_p_value: 0.7539932745346816
			},
			{
				index: 9,
				n1: 23,
				n2: 2632,
				n3: 18,
				n4: 2380,
				p_value: 0.7539932745318536,
				adjusted_p_value: 0.7539932745346816
			}
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

tape('test #7', async function(test) {
	const input = [
		{ index: 0, n1: 214, n2: 2057, n3: 134, n4: 1954 },
		{ index: 1, n1: 134, n2: 1954, n3: 214, n4: 2057 },
		{ index: 2, n1: 1863, n2: 225, n3: 1935, n4: 336 },
		{ index: 3, n1: 1935, n2: 336, n3: 1863, n4: 225 },
		{ index: 4, n1: 106, n2: 2165, n3: 74, n4: 2014 },
		{ index: 5, n1: 74, n2: 2014, n3: 106, n4: 2165 },
		{ index: 6, n1: 7, n2: 2264, n3: 6, n4: 2082 },
		{ index: 7, n1: 6, n2: 2082, n3: 7, n4: 2264 },
		{ index: 8, n1: 9, n2: 2262, n3: 11, n4: 2077 },
		{ index: 9, n1: 11, n2: 2077, n3: 9, n4: 2262 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		'[{"index":0,"n1":214,"n2":2057,"n3":134,"n4":1954,"p_value":0.0002691089492952078,"adjusted_p_value":0.0006727723732396717},' +
			'{"index":1,"n1":134,"n2":1954,"n3":214,"n4":2057,"p_value":0.0002691089492958687,"adjusted_p_value":0.0006727723732396717},' +
			'{"index":2,"n1":1863,"n2":225,"n3":1935,"n4":336,"p_value":0.00007531551396222635,"adjusted_p_value":0.0003765775698111318},' +
			'{"index":3,"n1":1935,"n2":336,"n3":1863,"n4":225,"p_value":0.00007531551396222635,"adjusted_p_value":0.0003765775698111318},' +
			'{"index":4,"n1":106,"n2":2165,"n3":74,"n4":2014,"p_value":0.06742991370741595,"adjusted_p_value":0.11238318951235993},' +
			'{"index":5,"n1":74,"n2":2014,"n3":106,"n4":2165,"p_value":0.06742991370741595,"adjusted_p_value":0.11238318951235993},' +
			'{"index":6,"n1":7,"n2":2264,"n3":6,"n4":2082,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":7,"n1":6,"n2":2082,"n3":7,"n4":2264,"p_value":1.0,"adjusted_p_value":1.0},' +
			'{"index":8,"n1":9,"n2":2262,"n3":11,"n4":2077,"p_value":0.654961243072022,"adjusted_p_value":0.8187015538400275},' +
			'{"index":9,"n1":11,"n2":2077,"n3":9,"n4":2262,"p_value":0.654961243072022,"adjusted_p_value":0.8187015538400275}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

tape('test #8', async function(test) {
	const input = [
		{ index: 0, n1: 331, n2: 3882, n3: 17, n4: 129 },
		{ index: 1, n1: 17, n2: 129, n3: 331, n4: 3882 },
		{ index: 2, n1: 3707, n2: 506, n3: 91, n4: 55 },
		{ index: 3, n1: 91, n2: 55, n3: 3707, n4: 506 },
		{ index: 4, n1: 159, n2: 4054, n3: 21, n4: 125 },
		{ index: 5, n1: 21, n2: 125, n3: 159, n4: 4054 },
		{ index: 6, n1: 13, n2: 133, n3: 0, n4: 4213 },
		{ index: 7, n1: 16, n2: 4197, n3: 4, n4: 142 },
		{ index: 8, n1: 4, n2: 142, n3: 16, n4: 4197 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		'[{"index":0,"n1":331,"n2":3882,"n3":17,"n4":129,"p_value":0.11750907026915972,"adjusted_p_value":0.11750907026953054},' +
			'{"index":1,"n1":17,"n2":129,"n3":331,"n4":3882,"p_value":0.11750907026953054,"adjusted_p_value":0.11750907026953054},' +
			'{"index":2,"n1":3707,"n2":506,"n3":91,"n4":55,"p_value":8.530169287114188e-15,"adjusted_p_value":2.5590507861368255e-14},' +
			'{"index":3,"n1":91,"n2":55,"n3":3707,"n4":506,"p_value":8.530169287122752e-15,"adjusted_p_value":2.5590507861368255e-14},' +
			'{"index":4,"n1":159,"n2":4054,"n3":21,"n4":125,"p_value":3.670004916489808e-7,"adjusted_p_value":6.606008849681654e-7},' +
			'{"index":5,"n1":21,"n2":125,"n3":159,"n4":4054,"p_value":3.670004916489808e-7,"adjusted_p_value":6.606008849681654e-7},' +
			'{"index":6,"n1":13,"n2":133,"n3":0,"n4":4213,"p_value":3.9209943994528244e-20,"adjusted_p_value":3.528894959507542e-19},' +
			'{"index":7,"n1":16,"n2":4197,"n3":4,"n4":142,"p_value":0.0038498316001866297,"adjusted_p_value":0.004949783485954239},' +
			'{"index":8,"n1":4,"n2":142,"n3":16,"n4":4197,"p_value":0.0038498316001866297,"adjusted_p_value":0.004949783485954239}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

tape('test #9', async function(test) {
	const input = [
		{ index: 0, n1: 2545, n2: 2332, n3: 110, n4: 66 },
		{ index: 1, n1: 110, n2: 66, n3: 2545, n4: 2332 },
		{ index: 2, n1: 2332, n2: 2545, n3: 66, n4: 110 },
		{ index: 3, n1: 66, n2: 110, n3: 2332, n4: 2545 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 150, input })
	)

	test.deepEqual(
		output,
		'[{"index":0,"n1":2545,"n2":2332,"n3":110,"n4":66,"p_value":0.007142423249961792,"adjusted_p_value":0.007142423249975454},' +
			'{"index":1,"n1":110,"n2":66,"n3":2545,"n4":2332,"p_value":0.00714242324995956,"adjusted_p_value":0.007142423249975454},' +
			'{"index":2,"n1":2332,"n2":2545,"n3":66,"n4":110,"p_value":0.007142423249975454,"adjusted_p_value":0.007142423249975454},' +
			'{"index":3,"n1":66,"n2":110,"n3":2332,"n4":2545,"p_value":0.0071424232499752395,"adjusted_p_value":0.007142423249975454}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

tape('test #10', async function(test) {
	const input = [
		{ index: 0, n1: 2545, n2: 2332, n3: 110, n4: 66 },
		{ index: 1, n1: 110, n2: 66, n3: 2545, n4: 2332 },
		{ index: 2, n1: 2332, n2: 2545, n3: 66, n4: 110 },
		{ index: 3, n1: 66, n2: 110, n3: 2332, n4: 2545 }
	]

	const output = await run_rust(
		'fisher',
		JSON.stringify({ fisher_limit: 1000, fdr: true, individual_fisher_limit: 50, input })
	)

	test.deepEqual(
		output,
		'[{"index":0,"n1":2545,"n2":2332,"n3":110,"n4":66,"p_value":0.0070894885654559925,"adjusted_p_value":0.0070894885654559925},' +
			'{"index":1,"n1":110,"n2":66,"n3":2545,"n4":2332,"p_value":0.0070894885654559925,"adjusted_p_value":0.0070894885654559925},' +
			'{"index":2,"n1":2332,"n2":2545,"n3":66,"n4":110,"p_value":0.0070894885654559925,"adjusted_p_value":0.0070894885654559925},' +
			'{"index":3,"n1":66,"n2":110,"n3":2332,"n4":2545,"p_value":0.0070894885654559925,"adjusted_p_value":0.0070894885654559925}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})
