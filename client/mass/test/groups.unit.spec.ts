import tape from 'tape'
import {
	getFilter,
	getSampleFilter,
	getSamplelstTW,
	getSamplelstTWFromIds,
	getSamplelstTWFromFilters,
	getGroupFilterEntry,
	getGroupForRegion,
	getOthersGroup
} from '../groups'

/**
 * Tests:
 *  - groups getSamplelstTWFromIds()
 *  - groups getFilter()
 *  - groups getSampleFilter()
 *  - groups getSamplelstTW()
 */

const mockGrp1Values = [
	{ sampleId: 70, sample: 'SJALL044294' },
	{ sampleId: 100, sample: 'SJBALL047019' },
	{ sampleId: 109, sample: 'SJBALL047029' },
	{ sampleId: 139, sample: 'SJALL048686' },
	{ sampleId: 142, sample: 'SJALL048691' }
]
const mockGrp2Values = [
	{ sampleId: 49, sample: 'SJMLL033' },
	{ sampleId: 68, sample: 'SJALL046376' },
	{ sampleId: 73, sample: 'SJALL044301' },
	{ sampleId: 81, sample: 'SJBALL042261' },
	{ sampleId: 104, sample: 'SJBALL047023' }
]
const mockGrp1Name = 'Test Group 1'
const mockGrp2Name = 'Test Group 2'

const mockGrp1 = {
	name: mockGrp1Name,
	in: true,
	values: mockGrp1Values
}
const mockGrp2 = {
	name: mockGrp2Name,
	in: true,
	values: mockGrp2Values
}

const mockGrps = [mockGrp1, mockGrp2]

const mockTermGrp1Obj = {
	color: 'blue',
	key: mockGrp1Name,
	label: mockGrp1Name,
	list: mockGrp1Values
}

const mockTermGrp2Obj = {
	color: 'green',
	key: mockGrp2Name,
	label: mockGrp2Name,
	list: mockGrp2Values
}

const mockSamplelstTW = {
	isAtomic: true,
	q: { groups: mockGrps },
	term: {
		name: 'groups',
		type: 'samplelst',
		values: {
			[mockGrp1Name]: mockTermGrp1Obj,
			[mockGrp2Name]: mockTermGrp2Obj
		}
	}
}

const mockSamplelstTWOther = {
	isAtomic: true,
	term: {
		name: 'group',
		type: 'samplelst',
		values: {
			[mockGrp1Name]: mockTermGrp1Obj,
			[`Not in ${mockGrp1Name}`]: {
				key: `Not in ${mockGrp1Name}`,
				label: 'Not in Test Group 1',
				color: '#aaa',
				list: mockGrp1Values,
				in: false
			}
		}
	},
	q: {
		groups: [
			mockGrp1,
			{
				name: `Not in ${mockGrp1Name}`,
				in: false,
				values: mockGrp1Values
			}
		]
	}
}

function getFilterObj(opts) {
	if (!opts.values) throw new Error('getFilterObj: opts.values is required')
	const tvslst = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						name: opts.termName || '',
						type: 'samplelst',
						values: opts.values
					}
				},
				noEdit: true
			}
		]
	}
	return tvslst
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- mass/groups -***-')
	test.end()
})

tape('groups getSamplelstTWFromIds()', test => {
	test.timeoutAfter(100)

	let input

	// Test case 1: Single group with sampleId list
	input = mockGrp1Values.map(item => item.sampleId)
	const values = mockGrp1Values.map(item => {
		return { sampleId: item.sampleId }
	})
	const expected = {
		isAtomic: true,
		q: {
			groups: [{ name: 'group', in: true, values }]
		},
		term: {
			name: 'group',
			type: 'samplelst',
			values: {
				group: {
					key: 'group',
					list: values
				}
			}
		}
	}
	const result = getSamplelstTWFromIds(input)
	test.deepEqual(
		result,
		expected,
		'getSamplelstTWFromIds should return the correct tvslst object for a single group with sampleId list.'
	)

	// Test case 2: No sampleId
	input = ''
	test.throws(
		() => {
			getSamplelstTWFromIds(input)
		},
		/getSamplelstTWFromIds: ids is empty/,
		'getSamplelstTWFromIds should throw an error for an empty sampleId.'
	)

	// Test case 3: Input not an array
	input = 'testId1234'
	test.throws(
		() => {
			getSamplelstTWFromIds(input)
		},
		/getSamplelstTWFromIds: ids must be an array/,
		'getSamplelstTWFromIds should throw if input is not an array.'
	)

	test.end()
})

tape('groups getFilter()', test => {
	test.timeoutAfter(100)

	let input, result, expected

	// Test case 1: Multiple groups
	input = mockSamplelstTW
	expected = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				noEdit: false,
				type: 'tvs',
				tvs: {
					term: {
						name: 'groups',
						type: 'samplelst',
						values: {
							[mockGrp1Name]: mockTermGrp1Obj,
							[mockGrp2Name]: mockTermGrp2Obj
						}
					}
				}
			}
		]
	}
	result = getFilter(input)
	test.deepEqual(result, expected, 'getFilter should return the correct tvslst object for multiple groups.')

	// Test case 2: Single group
	input = mockSamplelstTWOther
	expected = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						name: 'group',
						type: 'samplelst',
						values: {
							[mockGrp1Name]: mockTermGrp1Obj,
							[`Not in ${mockGrp1Name}`]: {
								key: `Not in ${mockGrp1Name}`,
								label: `Not in ${mockGrp1Name}`,
								color: '#aaa',
								list: mockGrp1Values,
								in: false
							}
						}
					}
				},
				noEdit: false
			}
		]
	}
	result = getFilter(input)
	test.deepEqual(
		result,
		expected,
		'getFilter should return the correct tvslst object for one group with a other or "not in" group.'
	)

	test.end()
})

tape('groups getSampleFilter()', test => {
	test.timeoutAfter(100)
	let input

	// Test case 1: Valid sampleId
	input = 'testId1234'
	const values = {
		['']: {
			color: undefined,
			key: '',
			label: '',
			list: [{ sampleId: input }]
		}
	}
	const expected = getFilterObj({ values })
	const result = getSampleFilter(input)
	test.deepEqual(result, expected, 'getSampleFilter should return the correct tvslst object for a single sampleId.')

	// Test case 2: No sampleId
	input = ''
	test.throws(
		() => {
			getSampleFilter(input)
		},
		/getSampleFilter: sampleId is empty/,
		'getSampleFilter should throw an error for an empty sampleId.'
	)

	// Test case 3: Multiple sampleIds
	input = ['testId1234', 'testId5678']
	test.throws(
		() => {
			getSampleFilter(input)
		},
		/getSampleFilter: sampleId arg cannot be an array/,
		'getSampleFilter should throw if input is an array.'
	)

	test.end()
})

tape('groups getSamplelstTW()', test => {
	test.timeoutAfter(100)

	let input, result

	//Test case 1: Single group. Should create a second other or 'not in' group
	input = [
		{
			color: 'blue',
			items: mockGrp1Values,
			name: 'Test Group 1'
		}
	]
	result = getSamplelstTW(input)
	test.deepEqual(
		result,
		mockSamplelstTWOther,
		'getSamplelstTW should return the correct sample list for single group with not in group.'
	)

	//Test case 2: Two groups
	input = [
		{
			color: 'blue',
			items: mockGrp1Values,
			name: mockGrp1Name
		},
		{
			color: 'green',
			items: mockGrp2Values,
			name: mockGrp2Name
		}
	]
	result = getSamplelstTW(input)
	test.deepEqual(result, mockSamplelstTW, 'getSamplelstTW should return the correct sample list for two groups.')
	test.end()
})

tape('groups getSamplelstTWFromFilters()', test => {
	test.timeoutAfter(100)

	const filter = (key: string) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key }] } }]
	})
	const tw: any = getSamplelstTWFromFilters([
		{ name: mockGrp1Name, color: 'blue', filter: filter('1'), sampleCount: 3 },
		{ name: mockGrp2Name, color: 'green', filter: filter('2'), mapParent2Children: true }
	])
	test.deepEqual(
		tw,
		{
			isAtomic: true,
			term: {
				name: 'groups',
				type: 'samplelst',
				values: {
					[mockGrp1Name]: { key: mockGrp1Name, label: mockGrp1Name, color: 'blue' },
					[mockGrp2Name]: { key: mockGrp2Name, label: mockGrp2Name, color: 'green' }
				}
			},
			q: {
				groups: [
					{ name: mockGrp1Name, in: true, filter: filter('1'), sampleCount: 3 },
					{ name: mockGrp2Name, in: true, filter: filter('2'), mapParent2Children: true }
				]
			}
		},
		'should carry the filter of each group, and list no sample'
	)

	test.deepEqual(
		getGroupFilterEntry(tw, mockGrp2Name),
		filter('2'),
		'getGroupFilterEntry should give the filter of a group that is defined by one'
	)
	test.notEqual(getGroupFilterEntry(tw, mockGrp2Name), tw.q.groups[1].filter, 'as a copy')

	const listed: any = getSamplelstTW([{ name: mockGrp1Name, items: mockGrp1Values }])
	const entry = getGroupFilterEntry(listed, mockGrp1Name)
	test.equal(entry.type, 'tvs', 'getGroupFilterEntry should give a tvs for a group that lists its samples')
	test.deepEqual(
		entry.tvs.term.values.group.list,
		mockGrp1Values.map((v: any) => ({ sampleId: v.sampleId })),
		'that lists the samples of the category'
	)
	test.end()
})

tape('groups getGroupForRegion()', test => {
	test.timeoutAfter(100)

	const values = [{ sampleId: 1 }, { sampleId: 2 }]
	test.equal(getGroupForRegion({ name: 'a', values }), values, 'a group that lists its samples is its list')
	const filter = { type: 'tvslst', in: true, join: '', lst: [] }
	const filter0 = { op: 'and', content: [] }
	test.deepEqual(
		getGroupForRegion({ name: 'a', color: 'red', sampleCount: 3, filter, filter0, mapParent2Children: true }),
		{ filter, filter0, mapParent2Children: true },
		'a group defined by a filter is its filter, with its cohort filter and sample level'
	)
	test.deepEqual(getGroupForRegion({ name: 'a' }), [], 'a group with neither has no samples')
	test.end()
})

tape('groups getOthersGroup()', test => {
	test.timeoutAfter(100)

	const placeholder = { name: 'Not in a', in: false, values: [{ sampleId: 1, sample: 's1' }, { sampleId: 2 }] }
	const cohort = { type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key: '1' }] } }
	const group: any = getOthersGroup(placeholder, {
		filter: { type: 'tvslst', in: true, join: '', lst: [cohort] },
		filter0: null
	})
	test.equal(group.values, undefined, 'the group lists no sample')
	test.equal(group.in, true, 'the group is not a placeholder')
	test.equal(group.filter0, null, 'the group carries the cohort filter that it was made with')
	test.equal(group.filter.join, 'and', 'its filter joins two entries')
	const [notListed, inCohort] = group.filter.lst
	test.equal(notListed.tvs.isnot, true, 'the first entry excludes')
	test.deepEqual(
		Object.values(notListed.tvs.term.values).flatMap((v: any) => v.list.map(i => i.sampleId)),
		[1, 2],
		'the samples that the placeholder lists'
	)
	test.deepEqual(inCohort, cohort, 'the second entry is the filter of the app')
	test.deepEqual(
		getGroupForRegion(group),
		{ filter: group.filter, filter0: null, mapParent2Children: undefined },
		'a region request takes it as a filter'
	)

	const alone: any = getOthersGroup(placeholder, { filter: { type: 'tvslst', in: true, join: '', lst: [] } })
	test.equal(alone.filter.lst.length, 1, 'without a filter of the app, the filter only excludes the listed samples')
	test.notOk('filter0' in alone, 'and the group carries no cohort filter')
	test.end()
})
