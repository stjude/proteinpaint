import tape from 'tape'
import { getFilter, getSampleFilter, getSamplelstTW, getSamplelstTW2, getSamplelstTWFromIds } from '../groups'

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
	q: {
		groups: [mockGrp1, { name: `Not in ${mockGrp1Name}`, in: false, values: mockGrp1Values }]
	},
	term: {
		name: 'groups',
		type: 'samplelst',
		values: {
			[`Not in ${mockGrp1Name}`]: {
				color: '#aaa',
				key: `Not in ${mockGrp1Name}`,
				label: `Not in ${mockGrp1Name}`,
				list: mockGrp1Values
			},
			[mockGrp1Name]: mockTermGrp1Obj
		}
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
				noEdit: false,
				type: 'tvs',
				tvs: {
					term: {
						name: 'groups',
						type: 'samplelst',
						values: {
							[`Not in ${mockGrp1Name}`]: {
								color: '#aaa',
								key: `Not in ${mockGrp1Name}`,
								label: `Not in ${mockGrp1Name}`,
								list: mockGrp1Values
							},
							[mockGrp1Name]: mockTermGrp1Obj
						}
					}
				}
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

tape('groups getSamplelstTW2()', test => {
	test.timeoutAfter(100)

	const input = [
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
	const result = getSamplelstTW2(input)
	test.deepEqual(result, mockSamplelstTW, 'getSamplelstTW2 should return the correct sample list for two groups.')
	test.end()
})
