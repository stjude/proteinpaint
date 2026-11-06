/********************************************
Test script for 'rust/src/corr.rs'

Run test script as follows (from 'proteinpaint/'):

    npx tape rust/test/corr.unit.spec.js

The expected values are from cor.test() and p.adjust(method = "fdr") of R 4.5.2. They are compared with a relative
tolerance, since R accumulates sums in long double on x86, and in fused multiply-adds on arm64.
*********************************************/

import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const tolerance = 1e-9

const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1))

function close(test, actual, expected, label) {
	if (expected === null) {
		test.equal(actual, null, `${label} should be null`)
		return
	}
	const diff = Math.abs(actual - expected) / Math.max(Math.abs(expected), Number.MIN_VALUE)
	test.ok(diff < tolerance, `${label}: ${actual} should match R's ${expected}`)
}

function check(test, output, expected) {
	test.equal(output.length, expected.length, 'should give one result per term')
	for (const [i, e] of expected.entries()) {
		const o = output[i]
		test.equal(o.id, e.id, `term ${i} should keep its id`)
		test.equal(o.sample_size, e.sample_size, `${e.id} sample_size`)
		close(test, o.correlation, e.correlation, `${e.id} correlation`)
		close(test, o.original_p_value, e.original_p_value, `${e.id} original_p_value`)
		close(test, o.adjusted_p_value, e.adjusted_p_value, `${e.id} adjusted_p_value`)
	}
}

tape('pearson', async function (test) {
	const terms = [
		{ id: 'linear', v1: seq(8, i => i), v2: [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1] },
		{ id: 'weak', v1: seq(10, i => i), v2: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3] },
		{ id: 'negative', v1: [0.5, 1.7, 2.2, 3.9, 4.1, 5.6], v2: [9.1, 7.7, 8.2, 4.4, 5.0, 1.3] },
		// sd is 0, so R gives NA
		{ id: 'constant', v1: [1, 2, 3, 4, 5], v2: [2, 2, 2, 2, 2] },
		// a null leaves out its pair
		{ id: 'missing', v1: [1, null, 3, 4, 5, 6, 7], v2: [1.5, 2, null, 3.5, 6, 5.5, 8] },
		// fewer than 3 pairs, where cor.test() throws
		{ id: 'two pairs', v1: [1, null, 3, 4], v2: [1, 2, null, 5] }
	]
	const output = JSON.parse(await run_rust('corr', JSON.stringify({ method: 'pearson', terms })))
	// the p-values are adjusted over the 4 terms that have one
	check(test, output, [
		{
			id: 'linear',
			correlation: 0.99941947479581306,
			original_p_value: 4.8889336125551896e-10,
			adjusted_p_value: 1.9555734450220758e-9,
			sample_size: 8
		},
		{
			id: 'weak',
			correlation: 0.33432539901899477,
			original_p_value: 0.34507104773311198,
			adjusted_p_value: 0.34507104773311198,
			sample_size: 10
		},
		{
			id: 'negative',
			correlation: -0.96947179292193308,
			original_p_value: 0.0013837314327387283,
			adjusted_p_value: 0.0027674628654774567,
			sample_size: 6
		},
		{ id: 'constant', correlation: null, original_p_value: null, adjusted_p_value: null, sample_size: 5 },
		{
			id: 'missing',
			correlation: 0.95266472922998746,
			original_p_value: 0.01227448533677163,
			adjusted_p_value: 0.016365980449028837,
			sample_size: 5
		},
		{ id: 'two pairs', correlation: null, original_p_value: null, adjusted_p_value: null, sample_size: 2 }
	])
	test.end()
})

tape('spearman', async function (test) {
	const terms = [
		// n <= 9 without ties: exact p-value from all the permutations
		{ id: 'exact', v1: seq(7, i => i), v2: [2, 1, 4, 3, 7, 5, 6] },
		// 9 < n <= 1290 without ties: Edgeworth series
		{ id: 'edgeworth', v1: seq(30, i => i), v2: seq(30, i => ((i * 7) % 31) + i / 2) },
		// ties: t approximation
		{ id: 'ties', v1: [1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9, 9], v2: [2, 1, 3, 3, 5, 4, 6, 8, 7, 9, 9, 10] },
		// n > 1290: t approximation
		{ id: 'large', v1: seq(1300, i => i), v2: seq(1300, i => ((i * 577) % 1301) + i / 4) },
		{ id: 'constant', v1: [3, 1, 2], v2: [7, 7, 7] }
	]
	const output = JSON.parse(await run_rust('corr', JSON.stringify({ method: 'spearman', terms })))
	check(test, output, [
		{
			id: 'exact',
			correlation: 0.82142857142857129,
			original_p_value: 0.034126984126984124,
			adjusted_p_value: 0.034126984126984124,
			sample_size: 7
		},
		{
			id: 'edgeworth',
			correlation: 0.47942157953281422,
			original_p_value: 0.0079663283148064881,
			adjusted_p_value: 0.01062177108640865,
			sample_size: 30
		},
		{
			id: 'ties',
			correlation: 0.95943711828066336,
			original_p_value: 8.0780267147230183e-7,
			adjusted_p_value: 1.6156053429446037e-6,
			sample_size: 12
		},
		{
			id: 'large',
			correlation: 0.22376649198745549,
			original_p_value: 3.2413388827386357e-16,
			adjusted_p_value: 1.2965355530954543e-15,
			sample_size: 1300
		},
		{ id: 'constant', correlation: null, original_p_value: null, adjusted_p_value: null, sample_size: 3 }
	])
	test.end()
})

tape('invalid input', async function (test) {
	const message = e => (typeof e == 'string' ? e : e.message)
	try {
		await run_rust('corr', JSON.stringify({ method: 'kendall', terms: [] }))
		test.fail('should reject an unsupported method')
	} catch (e) {
		test.ok(message(e).includes('unsupported method'), 'should reject an unsupported method')
	}
	try {
		await run_rust('corr', JSON.stringify({ method: 'pearson', terms: [{ id: 'a', v1: [1, 2, 3], v2: [1, 2] }] }))
		test.fail('should reject vectors of different lengths')
	} catch (e) {
		test.ok(message(e).includes('different lengths'), 'should reject vectors of different lengths')
	}
	test.end()
})
