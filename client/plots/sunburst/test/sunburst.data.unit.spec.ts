import tape from 'tape'
import { buildTermTree, wedgeFilter, selectionFilter, selectionName, allowedSampleTypes } from '../sunburst.data.ts'
import { badgeCode, splitLabel } from '../SunburstRenderer.ts'

/*
Tests:
	buildTermTree() - names, own values, counts, path ids and colours
	wedgeFilter() - a wedge path as an "and" filter of tvs, incl. numeric ranges and filter groups
	selectionFilter() - one wedge, or several joined by "or"
	selectionName()
	allowedSampleTypes() - the line of descent through the rings' deepest sample type
	badgeCode(), splitLabel()
*/

/*************************
 reusable helper functions
**************************/

const dxTerm = { id: 'dx', name: 'Diagnosis', type: 'categorical', values: {} }
const ageTerm = { id: 'age', name: 'Age', type: 'float' }
const twLst = [
	{ $id: 'dx', term: dxTerm, q: { type: 'values' } },
	{ $id: 'age', term: ageTerm, q: { mode: 'discrete' } }
]

function getResponse(): any {
	return {
		total: 10,
		noFirstRingValue: 1,
		rings: [
			{
				categories: {
					B: { label: 'B-ALL', color: '#00f', tvs: { values: [{ key: 'B', label: 'B-ALL' }] } },
					T: { label: 'T-ALL', tvs: { values: [{ key: 'T', label: 'T-ALL' }] } }
				}
			},
			{
				categories: {
					'<10': { label: '<10', tvs: { ranges: [{ startunbounded: true, stop: 10, label: '<10' }] } }
				}
			}
		],
		nodes: [
			{ key: 'B', count: 7, children: [{ key: '<10', count: 5 }] },
			{ key: 'T', count: 3 }
		]
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sunburst data -***-')
	test.end()
})

tape('buildTermTree()', function (test) {
	const root = buildTermTree(getResponse(), twLst, 'All samples', { T: '#f00' })
	test.equal(root.name, 'All samples', 'should name the root')
	test.equal(root.count, 10, 'should count the samples in the chart at the root')
	const [b, t] = root.children
	test.equal(b.name, 'B-ALL', 'should name a wedge by its category label')
	test.equal(b.level, 'Diagnosis', 'should name a wedge ring by its term')
	test.equal(b.count, 7, 'should keep the wedge sample count')
	test.equal(b.value, 2, 'should give a wedge only the samples ending there as its own value')
	test.equal(b.children![0].value, 5, 'should give a leaf all its samples')
	test.equal(b.children![0].id, '[["dx","B"],["age","<10"]]', 'should id a wedge by its path of [$id, key] pairs')
	test.equal(b.color, '#00f', "should use the term's own category colour")
	test.equal(t.color, '#f00', 'should let a dataset first-ring colour win')
	test.equal(t.children, undefined, 'should not add children to a wedge without any')

	// a first-ring key that reads like a path of two rings
	const res = getResponse()
	const key = 'B|age=<10'
	res.rings[0].categories[key] = { label: key, tvs: { values: [{ key }] } }
	res.nodes.push({ key, count: 1 })
	const ids = buildTermTree(res, twLst, 'All samples').children.flatMap(n => [
		n.id,
		...(n.children || []).map(c => c.id)
	])
	test.equal(new Set(ids).size, ids.length, 'should give a distinct id to a wedge whose key contains | and =')
	test.end()
})

tape('wedgeFilter() and selectionFilter()', function (test) {
	const root = buildTermTree(getResponse(), twLst, 'All samples')
	const [b, t] = root.children
	const young = b.children![0]
	test.deepEqual(
		wedgeFilter([t], twLst),
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [{ type: 'tvs', tvs: { term: dxTerm, values: [{ key: 'T', label: 'T-ALL' }] } }]
		},
		'should select a first-ring wedge by one tvs'
	)
	test.deepEqual(
		wedgeFilter([b, young], twLst).lst.map((f: any) => f.tvs),
		[
			{ term: dxTerm, values: [{ key: 'B', label: 'B-ALL' }] },
			{ term: ageTerm, ranges: [{ startunbounded: true, stop: 10, label: '<10' }] }
		],
		'should join the categories of a wedge path, incl. a numeric range'
	)
	test.equal(wedgeFilter([b, young], twLst).join, 'and', 'should join a path by "and"')
	test.deepEqual(
		selectionFilter([[t]], twLst),
		wedgeFilter([t], twLst),
		'should use the filter of a single wedge as is'
	)
	const union = selectionFilter([[t], [b, young]], twLst)
	test.equal(union.join, 'or', 'should join several wedges by "or"')
	test.deepEqual(
		union.lst,
		[wedgeFilter([t], twLst), wedgeFilter([b, young], twLst)],
		'should hold one filter per wedge'
	)
	test.throws(() => selectionFilter([], twLst), /no wedge/, 'should throw on an empty selection')

	const groupFilter = { type: 'tvslst', in: true, join: '', lst: [] }
	const res = getResponse()
	res.rings[0].categories.T = { label: 'Group', filter: groupFilter }
	const t2 = buildTermTree(res, twLst, 'All').children[1]
	test.deepEqual(
		wedgeFilter([t2], twLst).lst[0],
		groupFilter,
		"should select a filter group's samples by its own filter"
	)
	test.end()
})

tape('selectionName()', function (test) {
	const root = buildTermTree(getResponse(), twLst, 'All samples')
	const [b, t] = root.children
	test.equal(selectionName([[b, b.children![0]]]), 'B-ALL › <10', 'should name one wedge by its path')
	test.equal(selectionName([[t], [b, b.children![0]]]), 'T-ALL or <10', 'should join the names of several wedges')
	test.equal(selectionName([[t]], 4), 'T-A…', 'should truncate a long name')
	test.end()
})

tape('badgeCode() and splitLabel()', function (test) {
	test.equal(badgeCode('AD'), 'AD', 'should keep a short upper-case name')
	test.equal(badgeCode('T-ALL'), 'T-ALL', 'should keep a 5-character upper-case name')
	test.equal(badgeCode('Frontal Cortex'), 'FC', 'should use the initials of a multi-word name')
	test.equal(badgeCode('10 to <20'), '10', 'should use the leading number of a bin label')
	test.equal(badgeCode('≥70'), '≥70', 'should keep a short bin label')
	test.equal(badgeCode('Human'), 'HU', 'should use the first two letters of a single word')
	test.deepEqual(splitLabel('Frontal Cortex', 10, 2), ['Frontal', 'Cortex'], 'should wrap at spaces')
	test.deepEqual(splitLabel('Hyperdiploid', 8, 1), ['Hyperdi…'], 'should truncate a word that does not fit')
	test.end()
})

tape('allowedSampleTypes()', test => {
	// patient > primary, PDX and CSF samples (siblings), and a type below primary
	const sampleTypes = {
		1: { name: 'patient', parent_id: null },
		2: { name: 'primary sample', parent_id: 1 },
		3: { name: 'PDX sample', parent_id: 1 },
		4: { name: 'CSF sample', parent_id: 1 },
		5: { name: 'cell line', parent_id: 2 }
	}
	const tw = (sample_type?: number) => ({ term: { sample_type } })
	test.equal(allowedSampleTypes([tw(2)], undefined), undefined, 'Should not limit without sample types')
	test.equal(allowedSampleTypes([tw(2)], { 2: { name: 'sample' } }), undefined, 'Should not limit with one sample type')
	test.equal(allowedSampleTypes([], sampleTypes), undefined, 'Should not limit with no other ring')
	test.equal(allowedSampleTypes([tw(1), tw()], sampleTypes), undefined, 'Should not limit with patient rings only')
	test.deepEqual(allowedSampleTypes([tw(1), tw(3)], sampleTypes), [1, 3], 'Should offer patient and PDX terms')
	test.deepEqual(
		allowedSampleTypes([tw(2)], sampleTypes),
		[1, 2, 5],
		'Should offer the line of descent through primary samples'
	)
	test.deepEqual(allowedSampleTypes([tw(2), tw(5)], sampleTypes), [2, 1, 5], 'Should follow the deepest ring')
	test.end()
})
