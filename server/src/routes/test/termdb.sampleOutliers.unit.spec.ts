import tape from 'tape'
import { getRows, validRequest } from '../termdb.sampleOutliers.ts'

/**
 * Tests
 *  - getRows(): ssGSEA z-scores, the sample left out of a group it is in
 *  - getRows(): ssGSEA boxplot values of the group
 *  - getRows(): gene expression on the log2(value+1) scale, minValue and the least sd
 *  - getRows(): gene expression boxplot values, back in the file's unit
 *  - validRequest()
 */

/**************
 helper functions
***************/

/** the count, mean and population sd of each row, as python/src/sampleOutliers.py computes them */
function getStats(rows: number[][]) {
	const n = rows.map(r => r.length)
	const mean = rows.map(r => r.reduce((a, b) => a + b, 0) / r.length)
	const sd = rows.map((r, i) => Math.sqrt(r.reduce((a, b) => a + (b - mean[i]) ** 2, 0) / r.length))
	return { n, mean, sd }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.sampleOutliers -***-')
	test.end()
})

tape('getRows(): ssGSEA', function (test) {
	// the sample's score is 10 in A and 0.5 in B; the others score 1-4 in A and all 0.5 in B
	const data = { items: ['A', 'B'], value: [10, 0.5] }
	const member = getRows(
		data,
		getStats([
			[1, 2, 3, 4, 10],
			[0.5, 0.5, 0.5, 0.5]
		]),
		'ssGSEA',
		{},
		true
	)
	// the other samples of A: mean 2.5, sd sqrt(1.25)
	test.deepEqual(
		member,
		[{ name: 'A', value: 10, z: 6.71 }],
		'Should leave the sample out of a group it is in, and give no z-score to a row of no variation in the others.'
	)
	const other = getRows(
		data,
		getStats([
			[1, 2, 3, 4],
			[0.5, 0.5, 0.5]
		]),
		'ssGSEA',
		{},
		false
	)
	test.deepEqual(
		other,
		[{ name: 'A', value: 10, z: 6.71 }],
		'Should give the same z-score against a group without the sample, e.g. a custom group.'
	)
	test.end()
})

tape('getRows(): ssGSEA box', function (test) {
	const data = { items: ['A', 'B'], value: [10, 3] }
	const stats = {
		...getStats([
			[1, 2, 3, 4, 5, 10],
			[1, 2, 3, 4, 5]
		]),
		// B has too few values for a box
		box: {
			min: [1, null],
			w1: [1, null],
			p25: [2, null],
			p50: [4, null],
			p75: [5, null],
			w2: [5, null],
			max: [10, null]
		}
	}
	const rows = getRows(data, stats, 'ssGSEA', {}, true)
	test.deepEqual(
		rows.map(r => r.box),
		[{ min: 1, w1: 1, p25: 2, p50: 4, p75: 5, w2: 5, max: 10 }, undefined],
		'Should give each row the boxplot values of the group, and none to a row without them.'
	)
	test.end()
})

tape('getRows(): gene expression', function (test) {
	const log = (v: number) => Math.log2(v + 1)
	// FPKM: the sample has 15 of G1 and 2 of G2, the other three samples have none; G3 has no value in the sample
	const data = { items: ['G1', 'G2', 'G3'], value: [log(15), log(2), null] }
	const stats = getStats([
		[0, 0, 0, log(15)],
		[0, 0, 0, log(2)],
		[0, 0, 0]
	])
	const rows = getRows(data, stats, 'geneExpression', {}, true)
	test.deepEqual(
		rows,
		[{ name: 'G1', value: 15, z: 16 }],
		'Should give the value in the file unit, the z-score on log2(value+1) against an sd of at least 0.25, and leave out a gene below 5 in the sample and the group.'
	)
	const rows2 = getRows(data, stats, 'geneExpression', { geneExpression: { minValue: 1 } }, true)
	test.deepEqual(
		rows2.map(r => r.name),
		['G1', 'G2'],
		'Should rank a gene at or above the minValue of the dataset.'
	)
	test.end()
})

tape('getRows(): gene expression box', function (test) {
	const log = (v: number) => Math.log2(v + 1)
	// FPKM of G1 in the group, on the log2(value+1) scale as python/src/sampleOutliers.py gives the box; G2 has a
	// value but no box, as a cached float32 box holds NaN for a missing value
	const fpkm = [0, 3, 7, 15, 31, 63]
	const data = { items: ['G1', 'G2'], value: [log(63), log(63)] }
	const f32 = (a: number[]) => Float32Array.from(a)
	const stats = {
		...getStats([fpkm.map(log), fpkm.map(log)]),
		box: {
			min: f32([log(0), NaN]),
			w1: f32([log(0), NaN]),
			p25: f32([log(3), NaN]),
			p50: f32([log(15), NaN]),
			p75: f32([log(31), NaN]),
			w2: f32([log(63), NaN]),
			max: f32([log(63), NaN])
		}
	}
	const rows = getRows(data, stats, 'geneExpression', {}, true)
	test.deepEqual(
		rows.map(r => r.box),
		[{ min: 0, w1: 0, p25: 3, p50: 15, p75: 31, w2: 63, max: 63 }, undefined],
		'Should give the box in the file unit, as the value, and none to a row whose box is NaN.'
	)
	test.end()
})

tape('validRequest()', function (test) {
	const base = { genome: 'hg38', dslabel: 'ds', sample: 'S1', kind: 'ssGSEA' }
	test.equal(validRequest(base).reference, undefined, 'Should accept a request without a reference group.')
	test.throws(() => validRequest({ ...base, kind: 'x' }), /invalid kind/, 'Should reject an unknown kind.')
	test.throws(
		() => validRequest({ ...base, reference: 'custom' }),
		/referenceFilter/,
		'Should require a filter for a custom group.'
	)
	const filter = { type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs' }] }
	test.deepEqual(
		validRequest({ ...base, reference: 'custom', referenceFilter: JSON.stringify(filter) }).referenceFilter,
		filter,
		'Should parse the filter of a GET request.'
	)
	test.throws(() => validRequest({ ...base, limit: 0 }), /limit/, 'Should reject a limit below 1.')
	test.end()
})
