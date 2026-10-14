import tape from 'tape'
import {
	parseSwimmerFiles,
	getDivideCategories,
	orderDivideCategories,
	getLaneValues,
	isLaneRequested,
	getTimeReference,
	shiftTimeline
} from '../termdb.swimmer.ts'

/**
 * Table of contents — swimmer unit tests
 *
 * parseSwimmerFiles()
 *   • groups range and point rows by sample, sorted by time
 *   • keeps a range with a non-numeric end as null, drops rows with bad start/time
 *   • a sample present in only one file still gets a lane
 *   • accepts a missing range or point file as empty text
 *   • reads the optional 4th point column as the point's own sample
 *
 * getDivideCategories()
 *   • maps a value key to its label, a multivalue value to all its labels
 *
 * orderDivideCategories()
 *   • bins first, then term.values order, then other labels alphabetically; only seen labels
 *
 * getLaneValues()
 *   • the patient value, else the values of all its samples
 *
 * isLaneRequested()
 *   • matches the patient or any of its samples
 *
 * getTimeReference()
 *   • the requested key, else the default, else the first; none without references
 *
 * shiftTimeline()
 *   • moves time 0 to the reference event, null without that event
 */

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.swimmer -***-')
	test.end()
})

tape('parseSwimmerFiles() groups range and point rows by sample, sorted by time', function (test) {
	const range = [
		'CompBio ID\tResponse\tstart_time\tend_time',
		'A\tConsolidation\t158\t206',
		'A\tInduction\t0\t157'
	].join('\n')
	const points = ['CompBio ID\tpoint\ttime', 'A\tDeath\t362', 'A\tProgressive.Disease\t206', ''].join('\n')
	const { bySample, skipped } = parseSwimmerFiles(range, points)
	test.deepEqual([...bySample.keys()], ['A'], 'one sample')
	test.deepEqual(
		bySample.get('A')?.ranges,
		[
			{ category: 'Induction', start: 0, end: 157 },
			{ category: 'Consolidation', start: 158, end: 206 }
		],
		'ranges sorted by start'
	)
	test.deepEqual(
		bySample.get('A')?.points,
		[
			{ event: 'Progressive.Disease', time: 206 },
			{ event: 'Death', time: 362 }
		],
		'points sorted by time'
	)
	test.deepEqual(skipped, { badRange: 0, badPoint: 0 }, 'nothing skipped')
	test.end()
})

tape('parseSwimmerFiles() keeps a range with non-numeric end as null, drops rows with bad start/time', function (test) {
	const range = ['h\th\th\th', 'A\tInduction\t0\tNA', 'A\tRT\tx\t10', 'B\tRT\t5'].join('\n')
	const points = ['h\th\th', 'A\tDeath\tNA', 'A\tFollow.Up\t12'].join('\n')
	const { bySample, skipped } = parseSwimmerFiles(range, points)
	test.deepEqual(bySample.get('A')?.ranges, [{ category: 'Induction', start: 0, end: null }], 'NA end kept as null')
	test.deepEqual(
		bySample.get('B')?.ranges,
		[{ category: 'RT', start: 5, end: null }],
		'missing end column kept as null'
	)
	test.deepEqual(bySample.get('A')?.points, [{ event: 'Follow.Up', time: 12 }], 'point with NA time dropped')
	test.deepEqual(skipped, { badRange: 1, badPoint: 1 }, 'skipped counts')
	test.end()
})

tape('parseSwimmerFiles() a sample present in only one file still gets a lane', function (test) {
	const { bySample } = parseSwimmerFiles('h\th\th\th\nA\tCSI\t0\t60', 'h\th\th\nB\tDeath\t8')
	test.deepEqual(bySample.get('A'), { ranges: [{ category: 'CSI', start: 0, end: 60 }], points: [] }, 'range only')
	test.deepEqual(bySample.get('B'), { ranges: [], points: [{ event: 'Death', time: 8 }] }, 'point only')
	test.end()
})

tape('parseSwimmerFiles() accepts a missing range or point file as empty text', function (test) {
	const rangeOnly = parseSwimmerFiles('h\th\th\th\nA\tCSI\t0\t60', '')
	test.deepEqual(
		rangeOnly.bySample.get('A'),
		{ ranges: [{ category: 'CSI', start: 0, end: 60 }], points: [] },
		'intervals only'
	)
	const pointOnly = parseSwimmerFiles('', 'h\th\th\nB\tDeath\t8')
	test.deepEqual(pointOnly.bySample.get('B'), { ranges: [], points: [{ event: 'Death', time: 8 }] }, 'events only')
	test.deepEqual(pointOnly.skipped, { badRange: 0, badPoint: 0 }, 'nothing skipped')
	test.end()
})

tape('parseSwimmerFiles() reads the optional 4th point column as the point sample', function (test) {
	const points = [
		'CompBio ID\tpoint\ttime\tSample ID',
		'A\tCSF\t53\tA_N2',
		'A\tFollow.Up\t40\t',
		'A\tCSF\t-3\t A_N1 '
	].join('\n')
	const { bySample } = parseSwimmerFiles('h\th\th\th', points)
	test.deepEqual(
		bySample.get('A')?.points,
		[
			{ event: 'CSF', time: -3, sample: 'A_N1' },
			{ event: 'Follow.Up', time: 40 },
			{ event: 'CSF', time: 53, sample: 'A_N2' }
		],
		'sample set when present and trimmed, absent when the column is blank'
	)
	test.end()
})

tape('getDivideCategories() maps a value key to its label, a multivalue value to all its labels', function (test) {
	const tw = { term: { values: { M: { label: 'Male' }, F: { label: 'Female' } } } }
	test.deepEqual(getDivideCategories(tw, { key: 'M', value: 'M' }), ['Male'], 'label from term.values')
	test.deepEqual(getDivideCategories({ term: {} }, { key: '<5', value: 3 }), ['<5'], 'bin label key kept')
	test.deepEqual(
		getDivideCategories({ term: {} }, { values: [{ key: 'SJATRT' }, { key: 'SJMB' }] }),
		['SJATRT', 'SJMB'],
		'multivalue gives every membership'
	)
	test.end()
})

tape('orderDivideCategories() orders bins, then term.values, then others; only seen labels', function (test) {
	const bins = [{ label: '<5' }, { label: '5 to <10' }, { label: '≥10' }]
	test.deepEqual(
		orderDivideCategories({ term: {} }, bins, new Set(['≥10', '<5'])),
		['<5', '≥10'],
		'bin order, unseen bin dropped'
	)
	const tw = { term: { values: { b: { label: 'B', order: 1 }, a: { label: 'A', order: 2 } } } }
	test.deepEqual(
		orderDivideCategories(tw, undefined, new Set(['A', 'Z', 'B', 'C'])),
		['B', 'A', 'C', 'Z'],
		'values order then alphabetical'
	)
	test.end()
})

tape('getLaneValues() uses the patient value, else the values of all its samples', function (test) {
	const values = { 1: { key: 'patient' }, 2: { key: 'primary' }, 3: { key: 'pdx' } }
	const get = id => values[id]
	test.deepEqual(getLaneValues(get, 1, [2, 3]), [{ key: 'patient' }], 'patient value wins over its samples')
	test.deepEqual(
		getLaneValues(get, 9, [2, 7, 3]),
		[{ key: 'primary' }, { key: 'pdx' }],
		'all annotated samples of the patient'
	)
	test.deepEqual(getLaneValues(get, 9, [7]), [], 'no value anywhere')
	test.deepEqual(getLaneValues(get, 9), [], 'patient without samples')
	test.end()
})

tape('isLaneRequested() matches the patient or any of its samples', function (test) {
	test.equal(isLaneRequested(new Set(['S1_patient']), 'S1_patient', ['S1']), true, 'the patient')
	const requested = new Set(['S1', 'S1_csf'])
	test.equal(isLaneRequested(requested, 'S1_patient', ['S1', 'S1_X1']), true, 'a sample of the patient')
	test.equal(isLaneRequested(requested, 'S2_patient', ['S2']), false, 'unrelated lane')
	test.end()
})

tape('getTimeReference() returns the requested key, else the default, else the first', function (test) {
	const refs = [
		{ key: 'Birth', timeLabel: 'Days after birth' },
		{ key: 'Treatment', event: 'Treatment', timeLabel: 'Days after treatment started', isDefault: true }
	]
	test.equal(getTimeReference(refs, 'Birth'), refs[0], 'requested key')
	test.equal(getTimeReference(refs), refs[1], 'isDefault')
	test.equal(getTimeReference([refs[0], { ...refs[1], isDefault: false }]), refs[0], 'first without isDefault')
	test.equal(getTimeReference(undefined, 'Birth'), undefined, 'no references')
	test.throws(() => getTimeReference(refs, 'Dx'), /unknown timeReference/, 'unknown key')
	test.end()
})

tape('shiftTimeline() moves time 0 to the reference event, null without that event', function (test) {
	const d = {
		ranges: [
			{ category: 'Induction', start: 140, end: 298 },
			{ category: 'RT', start: 300, end: null }
		],
		points: [
			{ event: 'Dx', time: 118 },
			{ event: 'Treatment', time: 140 },
			{ event: 'CSF', time: 130, sample: 'S1_N1' }
		]
	}
	test.equal(shiftTimeline(d)?.points, d.points, 'no event: as is')
	const t = shiftTimeline(d, 'Treatment')!
	test.deepEqual(
		t.ranges,
		[
			{ category: 'Induction', start: 0, end: 158 },
			{ category: 'RT', start: 160, end: null }
		],
		'ranges shifted, ongoing end kept null'
	)
	test.deepEqual(
		t.points,
		[
			{ event: 'Dx', time: -22 },
			{ event: 'Treatment', time: 0 },
			{ event: 'CSF', time: -10, sample: 'S1_N1' }
		],
		'points shifted, sample kept'
	)
	test.equal(d.points[1].time, 140, 'source data unchanged')
	test.equal(shiftTimeline(d, 'Death'), null, 'lane without the event')
	test.end()
})
