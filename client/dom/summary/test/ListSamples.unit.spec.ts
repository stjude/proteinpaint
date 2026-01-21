import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../ListSamples'
import { getBoxPlotMockData } from '#plots/boxplot/test/mockBoxPlotData.ts'
import type { AnnotatedSampleEntry } from 'types/termdb'

/*
Tests:
	- Default ListSamples constructor
	- ListSamples constructor throws for incomplete range parameters
	- ListSamples constructor throws for invalid config
	- getTvsLst() processes all three terms when present
    - ListSamples.getTvsLst() in constructor returns obj for categorical term and numeric overlay
	- getTvsLstEntry() handles missing term wrapper
	- createTvsValues() returns correct values array for numeric term
	- createTvsRanges() creates correct range for useRange=true
	- createTvsRanges() returns empty array for continuous term without bins
	- createTvsRanges() handles bins
	- createTvsRanges() handles uncomputable values
	- isContinuousOrBinned() returns correct boolean values per term type
	- isContinuousOrBinned() returns false when mode is not in term query
	- mayFilterGVSample() returns false for non-gene variant terms
*/

/*************************
 reusable helper functions
**************************/

function getNewListSamples() {
	const { mockConfig1, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig1],
		termfilter: { filter: 'test' }
	}
	const mockBins = { term1: { testKey: { start: 5, stop: 10 } } }
	const listSamples = new ListSamples({
		app: mockApp,
		termfilter: mockState.termfilter,
		config: mockConfig1,
		plot: mockPlot1 as any,
		bins: mockBins
	})

	return { listSamples, mockConfig1, mockPlot1, mockApp, mockState }
}

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/ListSamples -***-')
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

	const listSamples = new ListSamples({
		app: mockApp,
		termfilter: mockState.termfilter,
		config: mockConfig2,
		plot: mockPlot1 as any
	})

	test.equal(listSamples.app, mockApp, 'Should set app correctly')
	test.equal(listSamples.plot, mockPlot1, 'Should set plot correctly')

	test.end()
})

tape('ListSamples constructor throws for incomplete range parameters', test => {
	test.timeoutAfter(100)

	const { mockConfig1, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig1],
		termfilter: { filter: 'test' }
	}

	const message = 'Should throw error when start is provided without end'
	try {
		new ListSamples({
			app: mockApp,
			termfilter: mockState.termfilter,
			config: mockConfig1,
			plot: mockPlot1 as any,
			start: 10,
			end: undefined
		})
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	test.end()
})

tape('ListSamples constructor throws for invalid config', test => {
	test.timeoutAfter(100)

	const { mockConfig2, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig2],
		termfilter: { filter: 'test' }
	}
	const message = `Should throw error if missing .term in config`
	try {
		new ListSamples({ app: mockApp, termfilter: mockState.termfilter, config: {}, plot: mockPlot1 as any })
		test.fail(message)
	} catch (e: any) {
		test.pass(`${e}: ${message}`)
	}

	test.end()
})

tape('getTvsLst() processes all three terms when present', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()

	test.equal(listSamples.tvslst.lst.length, 2, 'Should process both term and term2')
	test.equal(listSamples.terms.length, 2, 'Should track both terms in terms array')

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
								first_bin: { startunbounded: true, stop: 2 }
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

tape('getTvsLstEntry() handles missing term wrapper', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()
	listSamples.t1 = null as any

	const message = 'Should throw error for missing term wrapper'
	try {
		listSamples.getTvsLstEntry(1)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

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

	listSamples.createTvsValues(mockTvs, mockConfig1.term, 'testValueKey')
	test.true(
		mockTvs.tvs.values.length == 1 && mockTvs.tvs.values[0].key === 'testValueKey',
		'Should create values array with the correct entry for continuous term'
	)

	test.end()
})

tape('createTvsRanges() creates correct range for useRange=true', test => {
	test.timeoutAfter(100)

	const { mockConfig1, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig1],
		termfilter: { filter: 'test' }
	}
	const listSamples = new ListSamples({
		app: mockApp,
		termfilter: mockState.termfilter,
		config: mockConfig1,
		plot: mockPlot1 as any,
		start: 10,
		end: 20
	})

	const mockTvs: any = { ranges: [] }
	listSamples.createTvsRanges(mockTvs, 1, '')

	test.equal(mockTvs.ranges.length, 1, 'Should create one range entry')
	test.equal(mockTvs.ranges[0].start, 10, 'Should set start value correctly')
	test.equal(mockTvs.ranges[0].stop, 20, 'Should set stop value correctly')
	test.equal(mockTvs.ranges[0].startinclusive, true, 'Should include start boundary')
	test.equal(mockTvs.ranges[0].stopinclusive, true, 'Should include stop boundary')

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

tape('createTvsRanges() handles bins', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()

	const mockTvs: any = {}
	listSamples.createTvsRanges(mockTvs, 1, 'testKey')

	test.equal(mockTvs.ranges.length, 1, 'Should handle bin value')

	test.end()
})

tape('createTvsRanges() handles uncomputable values', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()

	listSamples.t1.term.values = { '123': { label: 'UncompLabel', uncomputable: true } }
	listSamples.bins = { term1: {} }

	const mockTvs: any = {}
	listSamples.createTvsRanges(mockTvs, 1, 'UncompLabel')

	test.equal(mockTvs.ranges.length, 1, 'Should create range for uncomputable value')
	test.equal(mockTvs.ranges[0].label, 'UncompLabel', 'Should set correct label')

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

tape('isContinuousOrBinned() returns false when mode is not in term query', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()
	const mockTw: any = {
		term: { type: 'categorical' },
		q: {}
	}
	const result = listSamples.isContinuousOrBinned(mockTw, 1)

	test.equal(result, false, 'Should return false when mode is not defined')

	test.end()
})

tape('mayFilterGVSample() returns false for non-gene variant terms', test => {
	test.timeoutAfter(100)

	const { listSamples } = getNewListSamples()
	const mockSample: AnnotatedSampleEntry = {
		sample: 'test123',
		_ref_: { label: '' },
		term1: { key: 0, value: 'testValue' }
	}
	const result = listSamples.mayFilterGVSample(mockSample)

	test.equal(result, false, 'Should return false when no gene variant terms present')

	test.end()
})
