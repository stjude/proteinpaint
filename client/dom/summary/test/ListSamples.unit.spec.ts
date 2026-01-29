import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../ListSamples'
import { getBoxPlotMockData } from '#plots/boxplot/test/mockBoxPlotData.ts'

/*
Tests:
	- Default ListSamples constructor
	- ListSamples constructor throws for invalid plot
    - ListSamples.getTvsLst() in constructor returns obj for categorical term and numeric overlay
	- createTvsValues() returns correct values array for numeric term
	- createTvsRanges() returns empty array for continuous term without bins
	- isContinuousOrBinned() returns correct boolean values per term type
*/

function getNewListSamples() {
	const { mockConfig1, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig1],
		termfilter: { filter: 'test' }
	}
	const listSamples = new ListSamples(mockApp, mockState.termfilter, mockConfig1, mockPlot1 as any)

	return { listSamples, mockConfig1, mockPlot1, mockApp, mockState }
}

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/interactions/ListSamples -***-')
	test.end()
})

tape('Default ListSamples constructor', test => {
	test.timeoutAfter(100)

	const mockApp = {} as AppApi
	const { mockConfig2, mockPlot1 } = getBoxPlotMockData()
	const mockState: any = {
		plots: [mockConfig2],
		termfilter: { filter: 'test' }
	}

	const listSamples = new ListSamples(mockApp, mockState.termfilter, mockConfig2, mockPlot1 as any)

	test.equal(listSamples.app, mockApp, 'Should set app correctly')
	test.equal(listSamples.plot, mockPlot1, 'Should set plot correctly')

	test.end()
})

tape('ListSamples constructor throws for invalid plot', test => {
	test.timeoutAfter(100)

	const { mockConfig2, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig2],
		termfilter: { filter: 'test' }
	}
	const message = `Should throw error if plotConfig is not found`
	try {
		new ListSamples(mockApp, mockState.termfilter, mockConfig2, mockPlot1 as any)
		test.pass(message)
	} catch (e: any) {
		test.fail(`${e}: ${message}`)
	}

	test.end()
})

tape('ListSamples.getTvsLst() in constructor returns obj for categorical term and numeric overlay', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()

	const expected = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'agedx',
						name: 'Age at Cancer Diagnosis',
						unit: 'Years',
						type: 'float',
						bins: {
							label_offset: 1,
							default: {
								type: 'regular-bin',
								label_offset: 1,
								bin_size: 3,
								first_bin: { startunbounded: true, stop: 2 },
								mode: 'discrete'
								//label_offset_ignored: false
							},
							less: {
								type: 'regular-bin',
								label_offset: 1,
								bin_size: 5,
								first_bin: { startunbounded: true, stop: 5 },
								last_bin: { stopunbounded: true, start: 15 }
								//label_offset_ignored: false
							}
						},
						isleaf: true
					},
					ranges: [],
					values: [{ key: '1' }]
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: {
						id: 'sex',
						name: 'Sex',
						type: 'categorical',
						groupsetting: { disabled: true },
						values: { 1: { label: 'Female', color: 'blue' }, 2: { label: 'Male', color: '#e75480' } }
					},
					values: [{ key: '1' }]
				}
			}
		]
	}
	test.deepEqual(listSamples.tvslst, expected, `Should return expected tvslst object`)

	test.end()
})

tape('createTvsValues() returns correct values array for numeric term', test => {
	test.timeoutAfter(100)

	const { listSamples, mockConfig1 } = getNewListSamples()

	const mockTvs: any = {
		type: 'tvs',
		tvs: {
			term: mockConfig1.term as any
		}
	}

	listSamples.createTvsValues(mockTvs.tvs, mockConfig1.term, 'testValueKey')
	test.true(
		mockTvs.tvs.values.length == 1 && mockTvs.tvs.values[0].key === 'testValueKey',
		'Should create values array with the correct entry for continuous term'
	)

	test.end()
})

tape('createTvsRanges() returns empty array for continuous term without bins', test => {
	test.timeoutAfter(100)

	const { listSamples, mockConfig1 } = getNewListSamples()

	const mockTvs: any = {
		type: 'tvs',
		tvs: {
			term: mockConfig1.term as any
		}
	}

	listSamples.createTvsRanges(mockTvs.tvs, 1, '')
	test.equal(mockTvs.tvs.ranges.length, 0, 'Should not create ranges for continuous term without bins')

	test.end()
})

tape('isContinuousOrBinned() returns correct boolean values per term type', test => {
	test.timeoutAfter(100)

	const { listSamples, mockConfig1 } = getNewListSamples()

	const term1Result = listSamples.isContinuousOrBinned(mockConfig1.term as any, 1)
	test.equal(term1Result, true, 'Should return true for continuous or binned term')

	const term2Result = listSamples.isContinuousOrBinned(mockConfig1.term2 as any, 2)
	test.equal(term2Result, false, 'Should return false for non-numeric term')

	test.end()
})
