/********************************************
Test script for 'rust/src/wilcoxon.rs'

Run test script as follows (from 'proteinpaint/'):

    node rust/test/wilcoxonTest.js

*********************************************/

const tape = require('tape')
const run_rust = require('@sjcrh/proteinpaint-rust').run_rust
//const run_R = require('../../server/src/run_R.js')
import run_R from '../../server/src/run_R.js'

// Fisher's exact test
tape('test #1', async function (test) {
	//const input = '[{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"African Ancestry","group2_values":[11.5,5.1,21.1,4.4,-0.04]},{"group1_id":"European Ancestry","group1_values":[3.7,2.5,5.9,13.1,1,10.6,3.2,3,6.5,15.5,2.6,16.5,2.6,4,8.6,8.3,1.9,7.9,7.9,6.1,17.6,3.1,3,1.5,8.1,18.2,-1.8,3.6,6,1.9,8.9,3.2,0.3,-1,11.2,6.2,16.2,7.5,9,9.4,18.9,0.1,11.5,10.1,12.5,14.6,1.5,17.3,15.4,7.6,2.4,13.5,3.8,17],"group2_id":"Asian Ancestry","group2_values":[1.7]},{"group1_id":"African Ancestry","group1_values":[11.5,5.1,21.1,4.4,-0.04],"group2_id":"Asian Ancestry","group2_values":[]}]'

	const input = [
		{
			group1_id: 'European Ancestry',
			group1_values: [
				3.7, 2.5, 5.9, 13.1, 1, 10.6, 3.2, 3, 6.5, 15.5, 2.6, 16.5, 2.6, 4, 8.6, 8.3, 1.9, 7.9, 7.9, 6.1, 17.6, 3.1, 3,
				1.5, 8.1, 18.2, -1.8, 3.6, 6, 1.9, 8.9, 3.2, 0.3, -1, 11.2, 6.2, 16.2, 7.5, 9, 9.4, 18.9, 0.1, 11.5, 10.1, 12.5,
				14.6, 1.5, 17.3, 15.4, 7.6, 2.4, 13.5, 3.8, 17
			],
			group2_id: 'African Ancestry',
			group2_values: [11.5, 5.1, 21.1, 4.4, -0.04]
		}
	]

	const rust_output = await run_rust('wilcoxon', JSON.stringify(input))
	console.log('rust_output:', rust_output)

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 605, n2: 2050, n3: 503, n4: 1895, p_value: 0.12552895565046274, fisher_chisq: 'fisher' },
			{ index: 1, n1: 407, n2: 2248, n3: 329, n4: 2069, p_value: 0.11022312794146355, fisher_chisq: 'fisher' },
			{ index: 2, n1: 1047, n2: 1351, n3: 1083, n4: 1572, p_value: 0.04001628331711651, fisher_chisq: 'fisher' }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

// FIsher's exact test and low sample size
tape('test #2', async function (test) {
	const input = [
		{ index: 0, n1: 1, n2: 23, n3: 0, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ mtc: 'bon', skipLowSampleSize: true, input }))

	test.deepEqual(
		output,
		'[{"index":0,"n1":1,"n2":23,"n3":0,"n4":32,"p_value":null,"adjusted_p_value":null,"fisher_chisq":"NA"},' +
			'{"index":6,"n1":10,"n2":22,"n3":9,"n4":15,"p_value":0.7765396747006522,"adjusted_p_value":1.0,"fisher_chisq":"fisher"},' +
			'{"index":7,"n1":14,"n2":18,"n3":8,"n4":16,"p_value":0.5813323604231644,"adjusted_p_value":1.0,"fisher_chisq":"fisher"}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

// Fisher's exact test
tape('test #3', async function (test) {
	const input = [
		{ index: 0, n1: 3, n2: 3, n3: 15, n4: 32 },
		{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15 },
		{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16 }
	]

	const output = await run_rust('fisher', JSON.stringify({ input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{ index: 0, n1: 3, n2: 3, n3: 15, n4: 32, p_value: 0.39651669085633046, fisher_chisq: 'fisher' },
			{ index: 6, n1: 10, n2: 22, n3: 9, n4: 15, p_value: 0.7765396747006522, fisher_chisq: 'fisher' },
			{ index: 7, n1: 14, n2: 18, n3: 8, n4: 16, p_value: 0.5813323604231644, fisher_chisq: 'fisher' }
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test with FDR
tape('test #5', async function (test) {
	const input = [
		{ index: 1, n1: 3, n2: 29, n3: 3, n4: 21 },
		{ index: 2, n1: 3, n2: 21, n3: 3, n4: 29 },
		{ index: 3, n1: 5, n2: 27, n3: 3, n4: 21 },
		{ index: 4, n1: 3, n2: 21, n3: 5, n4: 27 }
	]

	const output = await run_rust('fisher', JSON.stringify({ mtc: 'fdr', input }))

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

//Fisher's exact test with FDR, no skipped tests
tape('test #6', async function (test) {
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

	const output = await run_rust('fisher', JSON.stringify({ mtc: 'fdr', input }))

	test.deepEqual(
		output,
		JSON.stringify([
			{
				index: 0,
				n1: 605,
				n2: 2050,
				n3: 503,
				n4: 1895,
				p_value: 0.12552895565046274,
				adjusted_p_value: 0.16737194086759338,
				fisher_chisq: 'fisher'
			},
			{
				index: 1,
				n1: 503,
				n2: 1895,
				n3: 605,
				n4: 2050,
				p_value: 0.12552895565069505,
				adjusted_p_value: 0.16737194086759338,
				fisher_chisq: 'fisher'
			},
			{
				index: 2,
				n1: 407,
				n2: 2248,
				n3: 329,
				n4: 2069,
				p_value: 0.11022312794146355,
				adjusted_p_value: 0.16737194086759338,
				fisher_chisq: 'fisher'
			},
			{
				index: 3,
				n1: 329,
				n2: 2069,
				n3: 407,
				n4: 2248,
				p_value: 0.11022312794169503,
				adjusted_p_value: 0.16737194086759338,
				fisher_chisq: 'fisher'
			},
			{
				index: 4,
				n1: 1047,
				n2: 1351,
				n3: 1083,
				n4: 1572,
				p_value: 0.04001628331711651,
				adjusted_p_value: 0.16006513326846605,
				fisher_chisq: 'fisher'
			},
			{
				index: 5,
				n1: 1083,
				n2: 1572,
				n3: 1047,
				n4: 1351,
				p_value: 0.04001628331711651,
				adjusted_p_value: 0.16006513326846605,
				fisher_chisq: 'fisher'
			},
			{
				index: 6,
				n1: 537,
				n2: 2118,
				n3: 501,
				n4: 1897,
				p_value: 0.576969330929805,
				adjusted_p_value: 0.5769693309301023,
				fisher_chisq: 'fisher'
			},
			{
				index: 7,
				n1: 501,
				n2: 1897,
				n3: 537,
				n4: 2118,
				p_value: 0.5769693309301023,
				adjusted_p_value: 0.5769693309301023,
				fisher_chisq: 'fisher'
			}
		]) + '\n',
		'should match expected output'
	)
	test.end()
})

//Fisher's exact test with FDR, have skipped tests
tape('test #7', async function (test) {
	const input = [
		{ index: 0, n1: 214, n2: 2057, n3: 134, n4: 1954 },
		{ index: 1, n1: 134, n2: 1954, n3: 214, n4: 2057 },
		{ index: 2, n1: 1863, n2: 225, n3: 1935, n4: 336 },
		{ index: 3, n1: 1935, n2: 336, n3: 1863, n4: 225 },
		{ index: 4, n1: 106, n2: 2165, n3: 74, n4: 2014 },
		{ index: 5, n1: 74, n2: 2014, n3: 106, n4: 2165 },
		{ index: 6, n1: 1, n2: 987, n3: 3, n4: 897 },
		{ index: 7, n1: 3, n2: 748, n3: 4, n4: 977 }
	]
	const output = await run_rust('fisher', JSON.stringify({ mtc: 'fdr', skipLowSampleSize: true, input }))

	test.deepEqual(
		output,
		'[{"index":0,"n1":214,"n2":2057,"n3":134,"n4":1954,"p_value":0.0002691089492952078,"adjusted_p_value":0.00040366342394380304,"fisher_chisq":"fisher"},' +
			'{"index":1,"n1":134,"n2":1954,"n3":214,"n4":2057,"p_value":0.0002691089492958687,"adjusted_p_value":0.00040366342394380304,"fisher_chisq":"fisher"},' +
			'{"index":2,"n1":1863,"n2":225,"n3":1935,"n4":336,"p_value":0.00008000919629094183,"adjusted_p_value":0.0002400275888728255,"fisher_chisq":"fisher"},' +
			'{"index":3,"n1":1935,"n2":336,"n3":1863,"n4":225,"p_value":0.00008000919629088455,"adjusted_p_value":0.0002400275888728255,"fisher_chisq":"fisher"},' +
			'{"index":4,"n1":106,"n2":2165,"n3":74,"n4":2014,"p_value":0.06742991370741595,"adjusted_p_value":0.06742991370741595,"fisher_chisq":"fisher"},' +
			'{"index":5,"n1":74,"n2":2014,"n3":106,"n4":2165,"p_value":0.06742991370741595,"adjusted_p_value":0.06742991370741595,"fisher_chisq":"fisher"},' +
			'{"index":6,"n1":1,"n2":987,"n3":3,"n4":897,"p_value":null,"adjusted_p_value":null,"fisher_chisq":"NA"},' +
			'{"index":7,"n1":3,"n2":748,"n3":4,"n4":977,"p_value":null,"adjusted_p_value":null,"fisher_chisq":"NA"}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})

//chi-square test with bon, have skipped tests
tape('test #8', async function (test) {
	const input = [
		{ index: 0, n1: 214, n2: 2057, n3: 134, n4: 1954 },
		{ index: 1, n1: 134, n2: 1954, n3: 214, n4: 2057 },
		{ index: 2, n1: 1863, n2: 225, n3: 1935, n4: 336 },
		{ index: 3, n1: 1935, n2: 336, n3: 1863, n4: 225 },
		{ index: 4, n1: 106, n2: 2165, n3: 74, n4: 2014 },
		{ index: 5, n1: 74, n2: 2014, n3: 106, n4: 2165 },
		{ index: 6, n1: 1, n2: 987, n3: 3, n4: 897 },
		{ index: 7, n1: 3, n2: 748, n3: 4, n4: 977 }
	]
	const output = await run_rust('fisher', JSON.stringify({ mtc: 'bon', skipLowSampleSize: true, input }))

	test.deepEqual(
		output,
		'[{"index":0,"n1":214,"n2":2057,"n3":134,"n4":1954,"p_value":0.0002691089492952078,"adjusted_p_value":0.0016146536957712468,"fisher_chisq":"fisher"},' +
			'{"index":1,"n1":134,"n2":1954,"n3":214,"n4":2057,"p_value":0.0002691089492958687,"adjusted_p_value":0.0016146536957752121,"fisher_chisq":"fisher"},' +
			'{"index":2,"n1":1863,"n2":225,"n3":1935,"n4":336,"p_value":0.00008000919629094183,"adjusted_p_value":0.000480055177745651,"fisher_chisq":"fisher"},' +
			'{"index":3,"n1":1935,"n2":336,"n3":1863,"n4":225,"p_value":0.00008000919629088455,"adjusted_p_value":0.00048005517774530725,"fisher_chisq":"fisher"},' +
			'{"index":4,"n1":106,"n2":2165,"n3":74,"n4":2014,"p_value":0.06742991370741595,"adjusted_p_value":0.4045794822444957,"fisher_chisq":"fisher"},' +
			'{"index":5,"n1":74,"n2":2014,"n3":106,"n4":2165,"p_value":0.06742991370741595,"adjusted_p_value":0.4045794822444957,"fisher_chisq":"fisher"},' +
			'{"index":6,"n1":1,"n2":987,"n3":3,"n4":897,"p_value":null,"adjusted_p_value":null,"fisher_chisq":"NA"},' +
			'{"index":7,"n1":3,"n2":748,"n3":4,"n4":977,"p_value":null,"adjusted_p_value":null,"fisher_chisq":"NA"}]' +
			'\n',
		'should match expected output'
	)
	test.end()
})
