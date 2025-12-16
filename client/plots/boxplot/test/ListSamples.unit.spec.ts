import type { AppApi } from '#rx'
import tape from 'tape'
import { ListSamples } from '../interactions/ListSamples'
import { getBoxPlotMockData } from './mockBoxPlotData'

/*
Tests:
	Default ListSamples()
	ListSamples() with invalid plot
    ListSamples.getTvsLst()
*/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/interactions/ListSamples -***-')
	test.end()
})

tape('Default ListSamples()', test => {
	test.plan(7)

	const mockApp = {} as AppApi
	const { mockConfig, mockPlot1 } = getBoxPlotMockData()
	const mockState: any = {
		plots: [mockConfig],
		termfilter: { filter: 'test' }
	}

	const listSamples = new ListSamples(mockApp, mockState, 'test_test', mockPlot1 as any)

	//Test initialization
	test.equal(listSamples.app, mockApp, 'app should be set correctly')
	test.equal(listSamples.plot, mockPlot1, 'plot should be set correctly')
	test.deepEqual(listSamples.term, mockState.plots[0].term, 'term should be set correctly')
	test.deepEqual(listSamples.dataOpts.terms, [mockState.plots[0].term], 'dataOpts.terms should be set correctly')
	test.deepEqual(listSamples.dataOpts.filter.join, 'and', 'dataOpts.filter.join should be set to "and"')
	test.deepEqual(
		listSamples.dataOpts.filter.lst,
		[mockState.termfilter.filter, listSamples.tvslst],
		'dataOpts.filter.lst should be set correctly'
	)
	test.equal(listSamples.dataOpts.filter.in, true, 'dataOpts.filter.in should be set to true')

	test.end()
})

tape('ListSamples() with invalid plot', test => {
	const { mockConfig, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig],
		termfilter: { filter: 'test' }
	}
	const message = `Should throw error if plotConfig is not found`
	try {
		new ListSamples(mockApp, mockState, 'test_test', mockPlot1 as any)
		test.pass(message)
	} catch (e: any) {
		test.fail(`${e}: ${message}`)
	}

	test.end()
})

tape('ListSamples.getTvsLst()', test => {
	const { mockConfig, mockPlot1 } = getBoxPlotMockData()
	const mockApp = {} as AppApi
	const mockState: any = {
		plots: [mockConfig],
		termfilter: { filter: 'test' }
	}
	const listSamples = new ListSamples(mockApp, mockState, 'test_test', mockPlot1 as any)

	const result = listSamples.getTvsLst(20, 100, true, mockState.plots[0].term, mockState.plots[0].term2)
	const expected = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
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
					values: [{ key: '1', label: '1' }]
				}
			},
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
					ranges: [
						{
							start: 20,
							stop: 100,
							startinclusive: true,
							stopinclusive: true,
							startunbounded: false,
							stopunbounded: false
						}
					]
				}
			}
		]
	}

	test.deepEqual(result, expected, `Should return expected tvslst object`)

	test.end()
})
