import tape from 'tape'
import { getRows, getValue, validRequest } from '../termdb.sampleOutliers.ts'

/**
 * Tests
 *  - getRows(): ssGSEA z-scores, the sample left out of a group it is in
 *  - getRows(): gene expression on the log2(value+1) scale, minValue and the least sd
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

tape('getValue(): falls back to the nearest ancestor with a value', function (test) {
	const tdbq = {
		id2sampleRefs: () => ({
			ancestors: [
				{ ancestor_id: 20, distance: 1 },
				{ ancestor_id: 10, distance: 2 }
			]
		})
	}
	test.equal(
		getValue(
			new Map([
				[10, 'root'],
				[20, 'parent']
			]),
			30,
			tdbq
		),
		'parent',
		'uses the nearest ancestor value before a more distant root'
	)
	test.equal(
		getValue(new Map([[10, 'root']]), 30, tdbq),
		'root',
		'falls back to the root when nearer ancestors lack values'
	)
	test.equal(
		getValue(
			new Map([
				[30, 'sample'],
				[20, 'parent']
			]),
			30,
			tdbq
		),
		'sample',
		'prefers the sample value'
	)
	test.equal(getValue(new Map(), 30, tdbq), undefined, 'returns undefined when no sample or ancestor has a value')
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
