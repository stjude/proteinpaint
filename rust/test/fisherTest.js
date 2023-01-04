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

	const output = await run_rust('fisher', JSON.stringify({ input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895, p_value: 0.1201870950989139, fisher_chisq: 'chisq' },
			{ index: 1, n1: 407, n2: 2248, n3: 329, n4: 2069, p_value: 0.10526546766901224, fisher_chisq: 'chisq' },
			{ index: 2, n1: 1047, n2: 1351, n3: 1083, n4: 1572, p_value: 0.03907918497577101, fisher_chisq: 'chisq' }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

// Chi-square test and test with low sample size
tape('test #2', async function(test) {
	const input = [
		{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32, p_value: null, fisher_chisq: 'NA' },
			{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15, p_value: 0.6249468134880591, fisher_chisq: 'chisq' },
			{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16, p_value: 0.42960690941598956, fisher_chisq: 'chisq' }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test and chi-square test
tape('test #3', async function(test) {
	const input = [
		{ index: 0, n1: 3, n2: 23, n3: 15, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 3, n2: 23, n3: 15, n4: 32, p_value: 0.0872191008314544, fisher_chisq: 'fisher' },
			{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15, p_value: 0.6249468134880591, fisher_chisq: 'chisq' },
			{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16, p_value: 0.42960690941598956, fisher_chisq: 'chisq' }
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

	const output = await run_rust('fisher', JSON.stringify({ fdr: true, input }))

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
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 1,
				n1: 503,
				n2: 1895,
				n3: 605,
				n4: 2050,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 2,
				n1: 407,
				n2: 2248,
				n3: 329,
				n4: 2069,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 3,
				n1: 329,
				n2: 2069,
				n3: 407,
				n4: 2248,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 4,
				n1: 1047,
				n2: 1351,
				n3: 1083,
				n4: 1572,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403,
				fisher_chisq: 'chisq'
			},
			{
				index: 5,
				n1: 1083,
				n2: 1572,
				n3: 1047,
				n4: 1351,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403,
				fisher_chisq: 'chisq'
			},
			{
				index: 6,
				n1: 537,
				n2: 2118,
				n3: 501,
				n4: 1897,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514,
				fisher_chisq: 'chisq'
			},
			{
				index: 7,
				n1: 501,
				n2: 1897,
				n3: 537,
				n4: 2118,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514,
				fisher_chisq: 'chisq'
			}
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test with FDR
tape('test #5', async function(test) {
	const input = [
		{ index: 1, n1: 3, n2: 29, n3: 3, n4: 21 },
		{ index: 2, n1: 3, n2: 21, n3: 3, n4: 29 },
		{ index: 3, n1: 5, n2: 27, n3: 3, n4: 21 },
		{ index: 4, n1: 3, n2: 21, n3: 5, n4: 27 }
	]

	const output = await run_rust('fisher', JSON.stringify({ fdr: true, input }))

	test.deepEqual(
		output,
		'[{"index":1,"n1":3,"n2":29,"n3":3,"n4":21,"p_value":1.0,"adjusted_p_value":1.0,"fisher_chisq":"fisher"},' +
			'{"index":2,"n1":3,"n2":21,"n3":3,"n4":29,"p_value":1.0,"adjusted_p_value":1.0,"fisher_chisq":"fisher"},' +
			'{"index":3,"n1":5,"n2":27,"n3":3,"n4":21,"p_value":1.0,"adjusted_p_value":1.0,"fisher_chisq":"fisher"},' +
			'{"index":4,"n1":3,"n2":21,"n3":5,"n4":27,"p_value":1.0,"adjusted_p_value":1.0,"fisher_chisq":"fisher"}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

//chi-square test with FDR
tape('test #6', async function(test) {
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

	const output = await run_rust('fisher', JSON.stringify({ fdr: true, input }))

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
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 1,
				n1: 503,
				n2: 1895,
				n3: 605,
				n4: 2050,
				p_value: 0.1201870950989139,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 2,
				n1: 407,
				n2: 2248,
				n3: 329,
				n4: 2069,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 3,
				n1: 329,
				n2: 2069,
				n3: 407,
				n4: 2248,
				p_value: 0.10526546766901224,
				adjusted_p_value: 0.16024946013188518,
				fisher_chisq: 'chisq'
			},
			{
				index: 4,
				n1: 1047,
				n2: 1351,
				n3: 1083,
				n4: 1572,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403,
				fisher_chisq: 'chisq'
			},
			{
				index: 5,
				n1: 1083,
				n2: 1572,
				n3: 1047,
				n4: 1351,
				p_value: 0.03907918497577101,
				adjusted_p_value: 0.15631673990308403,
				fisher_chisq: 'chisq'
			},
			{
				index: 6,
				n1: 537,
				n2: 2118,
				n3: 501,
				n4: 1897,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514,
				fisher_chisq: 'chisq'
			},
			{
				index: 7,
				n1: 501,
				n2: 1897,
				n3: 537,
				n4: 2118,
				p_value: 0.5582004721993514,
				adjusted_p_value: 0.5582004721993514,
				fisher_chisq: 'chisq'
			}
		]) + '\n',
		'should match expected output'
	)
	test.end()
})
