/********************************************
Test script for 'rust/src/survival.rs'

Run test script as follows (from 'proteinpaint/'):

    npx tape rust/test/survival.unit.spec.js

The expected values are from survfit() and survdiff() of the R survival package, with null instead of "NA".
*********************************************/

import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'

tape('three series', async function (test) {
	const input = [
		{ time: 1, status: 1, series: 'A' },
		{ time: 2, status: 0, series: 'A' },
		{ time: 3, status: 1, series: 'A' },
		{ time: 4, status: 1, series: 'A' },
		{ time: 1.5, status: 1, series: 'B' },
		{ time: 2.5, status: 1, series: 'B' },
		{ time: 2.5, status: 0, series: 'B' },
		{ time: 6, status: 0, series: 'B' },
		{ time: 0.5, status: 1, series: 'C' },
		{ time: 0.7, status: 1, series: 'C' },
		{ time: 1.2, status: 1, series: 'C' },
		{ time: 5, status: 0, series: 'C' }
	]
	const output = JSON.parse(await run_rust('survival', JSON.stringify(input)))
	const keys = ['series', 'time', 'surv', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk']
	const expected = [
		['A', 0, 1, 1, 1, 0, 0, 4],
		['A', 1, 0.75, 0.425932268497982, 1, 1, 0, 4],
		['A', 2, 0.75, 0.425932268497982, 1, 0, 1, 3],
		['A', 3, 0.375, 0.0839296381045799, 1, 1, 0, 2],
		['A', 4, 0, null, null, 1, 0, 1],
		['B', 0, 1, 1, 1, 0, 0, 4],
		['B', 1.5, 0.75, 0.425932268497982, 1, 1, 0, 4],
		['B', 2.5, 0.5, 0.187658928706588, 1, 1, 1, 3],
		['B', 6, 0.5, 0.187658928706588, 1, 0, 1, 1],
		['C', 0, 1, 1, 1, 0, 0, 4],
		['C', 0.5, 0.75, 0.425932268497982, 1, 1, 0, 4],
		['C', 0.7, 0.5, 0.187658928706588, 1, 1, 0, 3],
		['C', 1.2, 0.25, 0.0457907596660182, 1, 1, 0, 2],
		['C', 5, 0.25, 0.0457907596660182, 1, 0, 1, 1]
	]
	// R gives 15 significant digits
	const round = v => (typeof v == 'number' ? Number(v.toPrecision(15)) : v)
	test.deepEqual(
		output.estimates.map(e => keys.map(k => round(e[k]))),
		expected,
		'should match the estimates of R'
	)
	test.deepEqual(
		output.tests,
		[
			{ series1: 'A', series2: 'B', pvalue: '0.65' },
			{ series1: 'A', series2: 'C', pvalue: '0.67' },
			{ series1: 'B', series2: 'C', pvalue: '0.21' }
		],
		'should match the log-rank tests of R'
	)
	test.end()
})

tape('single series', async function (test) {
	const input = [
		{ time: 1, status: 1, series: '*' },
		{ time: 2, status: 1, series: '*' },
		{ time: 2, status: 1, series: '*' },
		{ time: 3, status: 0, series: '*' }
	]
	const output = JSON.parse(await run_rust('survival', JSON.stringify(input)))
	test.equal(output.tests, undefined, 'should not have tests')
	test.deepEqual(
		output.estimates.map(e => [e.time, e.surv, e.nrisk]),
		[
			[0, 1, 4],
			[1, 0.75, 4],
			[2, 0.25, 3],
			[3, 0.25, 1]
		],
		'should match the estimates of R'
	)
	test.end()
})

tape('identical series', async function (test) {
	const input = [
		{ time: 1, status: 1, series: 'a' },
		{ time: 1, status: 1, series: 'b' }
	]
	const output = JSON.parse(await run_rust('survival', JSON.stringify(input)))
	test.deepEqual(output.tests, [{ series1: 'a', series2: 'b', pvalue: '1' }], 'should give pvalue=1')
	test.end()
})

tape('invalid status', async function (test) {
	const input = [{ time: 1, status: 2, series: 'a' }]
	try {
		await run_rust('survival', JSON.stringify(input))
		test.fail('should throw')
	} catch (e) {
		test.ok(String(e).includes('invalid status'), 'should throw on an invalid status')
	}
	test.end()
})
