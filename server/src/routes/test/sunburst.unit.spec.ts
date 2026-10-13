import tape from 'tape'
import { nestSamples, getRing, validateTwLst, getUnitSampleType, sampleTypeAncestors } from '../termdb.sunburst.ts'

/**
 * Tests
 *  - validateTwLst()
 *  - getRing(): categorical values, groupset, numeric bins, uncomputable values
 *  - nestSamples(): counts, early-ending branches, ordering, no first-ring value
 *  - getUnitSampleType(): rings on one line of descent, sibling sample types rejected
 */

const dxTw = {
	$id: 'dx',
	term: {
		id: 'dx',
		name: 'Diagnosis',
		type: 'categorical',
		values: {
			B: { label: 'B-ALL', color: '#00f', order: 1 },
			T: { label: 'T-ALL', order: 2 },
			X: { label: 'Unknown', uncomputable: true }
		}
	},
	q: { type: 'values' }
}

const subTw = {
	$id: 'sub',
	term: { id: 'sub', name: 'Subtype', type: 'categorical', values: {} },
	q: { type: 'values' }
}

const ageTw = {
	$id: 'age',
	term: { id: 'age', name: 'Age', type: 'float', values: { '-9999': { label: 'unknown', uncomputable: true } } },
	q: { mode: 'discrete', type: 'regular-bin' }
}
const ageBins = [
	{ startunbounded: true, stop: 10, label: '<10', color: '#aaa' },
	{ start: 10, stopunbounded: true, startinclusive: true, label: '≥10', color: '#bbb' }
]

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/sunburst -***-')
	test.end()
})

tape('validateTwLst()', function (test) {
	test.throws(() => validateTwLst([]), /non-empty/, 'should reject an empty twLst')
	test.throws(() => validateTwLst([dxTw, dxTw]), /duplicate/, 'should reject a duplicate $id')
	test.throws(
		() => validateTwLst([{ $id: 'g', term: { type: 'geneVariant' }, q: {} }]),
		/unsupported/,
		'should reject a non-categorical, non-numeric term'
	)
	test.throws(
		() => validateTwLst([{ ...ageTw, q: { mode: 'continuous' } }]),
		/must be binned/,
		'should reject a continuous numeric term'
	)
	test.doesNotThrow(() => validateTwLst([dxTw, subTw, ageTw]), 'should accept categorical and binned numeric terms')
	test.end()
})

tape('getRing() categorical values', function (test) {
	const ring = getRing(dxTw, {})
	test.equal(ring.keyOf({ key: 'B', value: 'B' }), 'B', 'should key a sample by its category')
	test.equal(ring.keyOf({ key: 'X', value: 'X' }), undefined, 'should skip an uncomputable category')
	test.equal(ring.keyOf(undefined), undefined, 'should skip a sample without a value')
	test.deepEqual(
		ring.category('B'),
		{ label: 'B-ALL', tvs: { values: [{ key: 'B', label: 'B-ALL' }] }, color: '#00f' },
		'should label and colour a category from term.values and select it by a values tvs'
	)
	test.equal(ring.rank('T'), 2, 'should rank by term.values order')
	test.equal(getRing(subTw, {}).rank('a'), undefined, 'should not rank categories of a term without value order')
	test.end()
})

tape('getRing() groupset', function (test) {
	const tw = {
		...dxTw,
		term: { ...dxTw.term, groupsetting: { disabled: false } },
		q: {
			type: 'custom-groupset',
			customset: {
				groups: [
					{ name: 'Lymphoid', type: 'values', color: '#123', values: [{ key: 'B' }, { key: 'T' }] },
					{ name: 'Excluded', type: 'values', uncomputable: true, values: [{ key: 'X' }] },
					{ name: 'Adults', type: 'filter', color: '#456', filter: { type: 'tvslst', in: true, join: '', lst: [] } }
				]
			}
		}
	}
	const ring = getRing(tw, {})
	test.equal(ring.keyOf({ key: 'Lymphoid' }), 'Lymphoid', 'should key a sample by its group name')
	test.equal(ring.keyOf({ key: 'Excluded' }), undefined, 'should skip an uncomputable group')
	test.deepEqual(
		ring.category('Lymphoid'),
		{
			label: 'Lymphoid',
			color: '#123',
			tvs: {
				values: [
					{ key: 'B', label: undefined },
					{ key: 'T', label: undefined }
				]
			}
		},
		'should select a values group by all its values'
	)
	test.deepEqual(
		ring.category('Adults').filter,
		tw.q.customset.groups[2].filter,
		'should select a filter group by its filter'
	)
	test.equal(ring.rank('Adults'), 2, 'should rank groups in groupset order')
	test.end()
})

tape('getRing() numeric bins', function (test) {
	const ring = getRing(ageTw, { bins: ageBins })
	test.equal(ring.keyOf({ key: '<10', value: 3 }), '<10', 'should key a sample by its bin label')
	test.equal(ring.keyOf({ key: 'unknown', value: -9999 }), undefined, 'should skip an uncomputable value')
	test.equal(ring.keyOf({ key: 'other', value: 3 }), undefined, 'should skip a key that is not a bin')
	test.deepEqual(
		ring.category('≥10'),
		{ label: '≥10', tvs: { ranges: [{ start: 10, stopunbounded: true, startinclusive: true, label: '≥10' }] } },
		'should select a bin by its range, without the palette colour getData gives it'
	)
	test.equal(ring.rank('≥10'), 1, 'should rank bins in bin order')
	test.end()
})

tape('nestSamples()', function (test) {
	const twLst = [dxTw, subTw, ageTw]
	const rings = [getRing(dxTw, {}), getRing(subTw, {}), getRing(ageTw, { bins: ageBins })]
	const s = (dx?: string, sub?: string, age?: string) => {
		const o: any = {}
		if (dx) o.dx = { key: dx, value: dx }
		if (sub) o.sub = { key: sub, value: sub }
		if (age) o.age = { key: age, value: age == '<10' ? 5 : 20 }
		return o
	}
	const samples = [
		s('T', 'a', '<10'),
		s('B', 'b', '<10'),
		s('B', 'b', '≥10'),
		s('B', 'c'), // no age: ends at the subtype ring
		s('B'), // no subtype: ends at the diagnosis ring, even with an age
		{ ...s('B'), age: { key: '<10', value: 5 } },
		s(undefined, 'a', '<10'), // no diagnosis: not in the chart
		s('X', 'a') // uncomputable diagnosis: not in the chart
	]
	const res = nestSamples(samples, twLst, rings)
	test.equal(res.total, 6, 'should count the samples with a first-ring value')
	test.equal(res.noFirstRingValue, 2, 'should count the samples without a usable first-ring value')
	test.deepEqual(
		res.nodes.map(n => [n.key, n.count]),
		[
			['B', 5],
			['T', 1]
		],
		'should order first-ring wedges by term value order'
	)
	const b = res.nodes[0]
	test.deepEqual(
		b.children!.map(n => [n.key, n.count]),
		[
			['b', 2],
			['c', 1]
		],
		'should order unranked categories by count and leave samples without a subtype in the parent'
	)
	test.deepEqual(
		b.children![0].children!.map(n => [n.key, n.count]),
		[
			['<10', 1],
			['≥10', 1]
		],
		'should nest bins under their subtype'
	)
	test.equal(b.children![1].children, undefined, 'should not add children to a wedge whose samples all end there')
	test.deepEqual(
		Object.keys(res.rings[2].categories).sort(),
		['<10', '≥10'],
		'should describe every category seen per ring'
	)
	test.end()
})

// patient > primary, PDX and CSF samples (siblings), and a sample type below primary
const sampleTypes = {
	1: { name: 'patient', plural_name: 'patients', parent_id: null },
	2: { name: 'primary sample', plural_name: 'primary samples', parent_id: 1 },
	3: { name: 'PDX sample', plural_name: 'PDX samples', parent_id: 1 },
	4: { name: 'CSF sample', plural_name: 'CSF samples', parent_id: 1 },
	5: { name: 'cell line', plural_name: 'cell lines', parent_id: 2 }
}

tape('getUnitSampleType()', test => {
	test.deepEqual(sampleTypeAncestors(5, sampleTypes), [2, 1], 'Should list ancestors nearest first')
	test.equal(
		getUnitSampleType([undefined, undefined], sampleTypes),
		undefined,
		'Should be undefined with no known type'
	)
	test.equal(getUnitSampleType([1, 1], sampleTypes), 1, 'Should count patients with patient rings only')
	test.equal(getUnitSampleType([1, 2], sampleTypes), 2, 'Should count primary samples with patient and primary rings')
	test.equal(getUnitSampleType([3, 1], sampleTypes), 3, 'Should not depend on ring order')
	test.equal(getUnitSampleType([1, 2, 5], sampleTypes), 5, 'Should count the deepest type on a line of descent')
	test.equal(getUnitSampleType([2, undefined], sampleTypes), 2, 'Should ignore rings of unknown type')
	test.throws(
		() => getUnitSampleType([2, 3], sampleTypes),
		/primary samples and PDX samples cannot be combined/,
		'Should reject sibling sample types'
	)
	test.throws(
		() => getUnitSampleType([1, 5, 4], sampleTypes),
		/cannot be combined/,
		'Should reject a type off the line'
	)
	test.end()
})
