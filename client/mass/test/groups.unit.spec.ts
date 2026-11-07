import tape from 'tape'
import * as d3s from 'd3-selection'
import {
	getFilter,
	getSampleFilter,
	getSamplelstTW,
	getSamplelstTWFromIds,
	getSamplelstTWFromFilters,
	getGroupFilterEntry,
	getGroupFilterOfConditions,
	getGvGroupFilterEntry,
	getGroupForRegion,
	getOthersGroup,
	getAvailabilityGroups,
	renderPreAnalysisData,
	initDaSampleTypes
} from '../groups'

/**
 * Tests:
 *  - groups getSamplelstTWFromIds()
 *  - groups getFilter()
 *  - groups getSampleFilter()
 *  - groups getSamplelstTW()
 *  - groups getAvailabilityGroups()
 *  - groups renderPreAnalysisData()
 *  - groups initDaSampleTypes()
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

tape('groups getAvailabilityGroups()', test => {
	test.timeoutAfter(100)

	const sex = (key: string) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key }] } }]
	})
	const byFilter = getSamplelstTWFromFilters([
		{ name: 'a', filter: sex('1'), filter0: null, sampleCount: 3 },
		{ name: 'b', filter: sex('2'), mapParent2Children: true }
	])
	test.deepEqual(
		getAvailabilityGroups(byFilter),
		[
			{ name: 'a', filter: sex('1'), filter0: null },
			{ name: 'b', filter: sex('2'), mapParent2Children: true }
		],
		'a group defined by a filter is given as its filter, with its cohort filter and sample level'
	)

	const listed = getSamplelstTW([{ name: 'a', items: [{ sampleId: 1, sample: 's1' }, { sampleId: 2 }] }])
	const termfilter = { filter: sex('1'), filter0: { x: 1 } }
	const [a, notA]: any[] = getAvailabilityGroups(listed, termfilter)
	test.deepEqual(a, { name: 'a', values: [{ sampleId: 1 }, { sampleId: 2 }] }, 'a listed group is given as its ids')
	test.equal(notA.name, 'Not in a', 'the rest of a listed group is kept')
	test.notOk('values' in notA, 'the rest is not given as the list of the group it is the rest of')
	test.deepEqual(notA.filter, getOthersGroup(listed.q.groups[1], termfilter).filter, 'the rest is given as its filter')
	test.deepEqual(notA.filter0, { x: 1 }, 'with the cohort filter of the app')
	test.end()
})

tape('groups getGroupFilterOfConditions()', test => {
	const tvs = (id, key) => ({ type: 'tvs', tvs: { term: { id, type: 'categorical' }, values: [{ key }] } })
	const one = { type: 'tvslst', in: true, join: '', lst: [tvs('sex', '1')] }
	const two = { type: 'tvslst', in: true, join: 'and', lst: [tvs('diaggrp', 'a'), tvs('race', 'b')] }
	const either = { type: 'tvslst', in: true, join: 'or', lst: [tvs('diaggrp', 'a'), tvs('diaggrp', 'b')] }

	const single: any = getGroupFilterOfConditions([undefined, one])
	test.equal(single.tag, 'filterUiRoot', 'the filter is the part of a group that is its own')
	test.deepEqual(single.lst, one.lst, 'a filter that is not given is left out')

	const joined: any = getGroupFilterOfConditions([one, { type: 'tvslst', in: true, join: '', lst: [] }, two])
	test.equal(joined.join, 'and', 'filters are joined with "and"')
	test.deepEqual(joined.lst, [...one.lst, ...two.lst], 'with the conditions of each, and an empty filter is left out')

	const nested: any = getGroupFilterOfConditions([one, either])
	test.deepEqual(
		[nested.join, nested.lst.length, nested.lst[1].join],
		['and', 2, 'or'],
		'a filter of alternatives stays one entry'
	)
	test.notOk(JSON.stringify(nested).includes('sampleId'), 'no sample is listed')
	test.end()
})

tape('groups getGvGroupFilterEntry()', test => {
	const dt = (type, key) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id: type, type }, values: [{ key }] } }]
	})
	const groups = [
		{ name: 'Mutated', type: 'filter', filter: dt('dtsnvindel', 'M') },
		{ name: 'Loss', type: 'filter', filter: dt('dtcnv', 'CNV_loss') },
		{ name: 'Wildtype', type: 'filter', filter: dt('dtsnvindel', 'WT') }
	]
	const tw = { term: { type: 'geneVariant', name: 'TP53' }, q: { type: 'custom-groupset', customset: { groups } } }

	test.deepEqual(getGvGroupFilterEntry(tw, 'Mutated'), groups[0].filter, 'the first group is its filter')
	const third: any = getGvGroupFilterEntry(tw, 'Wildtype')
	test.deepEqual(
		third.lst.map(i => [i.tvs.term.id, i.tvs.values[0].key, !!i.tvs.isnot]),
		[
			['dtsnvindel', 'WT', false],
			['dtsnvindel', 'M', true],
			['dtcnv', 'CNV_loss', true]
		],
		'a later group is its filter, without the samples of the groups before it'
	)
	test.deepEqual(groups[2].filter, dt('dtsnvindel', 'WT'), 'the filters of the tw are not modified')

	const predefined = {
		term: { type: 'geneVariant', name: 'TP53', groupsetting: { lst: [{ groups: [] }, { groups }] } },
		q: { type: 'predefined-groupset', predefined_groupset_idx: 1 }
	}
	test.deepEqual(
		getGvGroupFilterEntry(predefined, 'Mutated'),
		groups[0].filter,
		'the groups of a predefined set are used'
	)
	test.equal(getGvGroupFilterEntry(tw, 'Other'), undefined, 'undefined for a group that the tw does not have')
	test.equal(
		getGvGroupFilterEntry({ term: tw.term, q: { type: 'values' } }, 'Mutated'),
		undefined,
		'undefined without a group setting'
	)
	test.end()
})

tape('groups renderPreAnalysisData()', test => {
	const holder: any = d3s.select('body').append('div')
	const samplelstTW = {
		q: { groups: [{ name: 'g1' }, { name: 'g2' }] },
		term: { values: { g1: { color: 'red' }, g2: { color: 'blue' } } }
	}
	const render = (data: any, alert?: string) => {
		holder.selectAll('*').remove()
		renderPreAnalysisData({ preAnalysisData: { data, alert }, samplelstTW, groups: [], holder, self: {} })
		return {
			inputs: holder.selectAll('input[type=radio]').nodes() as HTMLInputElement[],
			run: holder.select('[data-testid=sjpp-da-run-btn]').node()
		}
	}

	const under = render({ g1: 100, g2: 100 })
	test.equal(under.inputs.length, 3, 'should list the 3 methods')
	test.ok(
		under.inputs.every(i => !i.disabled),
		'should offer every method under the limit'
	)
	test.ok(under.run, 'should show the run button')

	const alert = '2980 samples selected exceeds the limit of 500 per run. Please narrow the cohort.'
	const over = render({ g1: 2930, g2: 50 }, alert)
	test.equal(over.inputs.length, 3, 'should still list the 3 methods over the limit')
	test.ok(
		over.inputs.every(i => i.disabled),
		'should gray out every method over the limit'
	)
	test.equal(over.run, null, 'should not show the run button over the limit')
	test.ok(holder.text().includes(alert), 'should show the alert')

	// the sample types chosen above the panel go with the plot, and are left out when none were chosen
	const dispatched: any[] = []
	const self = { state: {}, app: { dispatch: (a: any) => dispatched.push(a) } }
	for (const sampleTypes of [[2], undefined]) {
		holder.selectAll('*').remove()
		renderPreAnalysisData({
			preAnalysisData: { data: { g1: 10, g2: 10 } },
			samplelstTW,
			groups: [],
			holder,
			termType: 'junction',
			self,
			sampleTypes
		})
		;(holder.select('[data-testid=sjpp-da-run-btn]').node() as HTMLElement).click()
	}
	test.deepEqual(dispatched[0].config.sampleTypes, [2], 'should send the chosen sample types to the plot')
	test.notOk('sampleTypes' in dispatched[1].config, 'should not send sample types when none were chosen')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('groups initDaSampleTypes()', test => {
	const holder: any = d3s.select('body').append('div')
	const termdbConfig: any = {
		sampleTypes: {
			1: { name: 'Patient', parent_id: null },
			2: { name: 'Diagnosis', parent_id: 1 },
			3: { name: 'Relapse', parent_id: 1 }
		}
	}
	const self = { app: { vocabApi: { termdbConfig } } }

	const none = initDaSampleTypes(holder, undefined, self, () => {})
	test.equal(holder.selectAll('input[type=checkbox]').size(), 0, 'should draw no row without a query')
	test.equal(none.sampleTypes(), undefined, 'should send no sample types without a query')
	initDaSampleTypes(holder, { sampleTypes: [1, 2] }, self, () => {})
	test.equal(holder.selectAll('input[type=checkbox]').size(), 0, 'should draw no row when one type has a parent')

	holder.selectAll('*').remove()
	let changes = 0
	const { sampleTypes, panelDiv } = initDaSampleTypes(holder, { sampleTypes: [1, 2, 3] }, self, () => changes++)
	const boxes = holder.selectAll('input[type=checkbox]').nodes() as HTMLInputElement[]
	test.equal(boxes.length, 2, 'should draw a checkbox for each sample type with a parent, not for the root type')
	test.equal(sampleTypes(), undefined, 'should send no sample types when every type is checked')

	boxes[1].click()
	test.deepEqual(sampleTypes(), [2], 'should send the checked sample types')
	test.equal(changes, 1, 'should call onChange when a sample type changes')

	// the panel below has controls of its own, which must not fetch the counts again
	const box = panelDiv.append('input').attr('type', 'checkbox').node()
	box.click()
	test.equal(changes, 1, 'should not call onChange for a change in the panel below')

	holder.selectAll('*').remove()
	termdbConfig.sampleTypeTerms = { visit: { name: 'Visit' } }
	const byTerms = { visit: { Any: [1], Diagnosis: [2], Relapse: [3] } }
	initDaSampleTypes(holder, { sampleTypes: [1, 2, 3], sampleTypesByTerms: byTerms }, self, () => {})
	test.deepEqual(
		holder
			.selectAll('option')
			.nodes()
			.map((o: any) => o.value),
		['any', 'Diagnosis', 'Relapse'],
		'should offer no dropdown value of sample types without a parent alone'
	)

	if (test['_ok']) holder.remove()
	test.end()
})
