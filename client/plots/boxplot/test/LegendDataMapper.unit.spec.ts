import { LegendDataMapper } from '../viewModel/LegendDataMapper'
import { getBoxPlotMockData } from './mockBoxPlotData'
import tape from 'tape'

/*
Tests:
	- LegendDataMapper constructor with term and overlay term
	- LegendDataMapper.map() returns an array of legend sections for term and overlay term
	- LegendDataMapper.getHiddenPlots() returns correct hidden plots
	- LegendDataMapper.setDescrStatItems() sets the correct legend items
	- LegendDataMapper.setHiddenCategoryItems() returns the correct legend items per hidden plots and uncomputatble values

See unit tests for #dom/boxplot for rendering unit tests
*/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/viewModel/LegendDataMapper -***-')
	test.end()
})

tape('LegendDataMapper constructor with term and overlay term', function (test) {
	test.timeoutAfter(100)

	const { mockConfig1 } = getBoxPlotMockData()
	const legendMapper = new LegendDataMapper(mockConfig1)

	test.equal(legendMapper.legendData.length, 2, 'Should create 2 legend sections when term and overlay present')
	test.equal(
		legendMapper.legendData[0].label,
		`Descriptive Statistics: ${mockConfig1.term.term.name}`,
		'Should set the first section for term'
	)
	test.equal(
		legendMapper.legendData[1].label,
		`Descriptive Statistics: ${mockConfig1.term2.term.name}`,
		'Should set the second section for term'
	)

	test.end()
})

tape('LegendDataMapper.map() returns an array of legend sections for term and overlay term', function (test) {
	test.timeoutAfter(100)

	const { mockConfig1, mockData } = getBoxPlotMockData()
	const legendMapper = new LegendDataMapper(mockConfig1)

	const result = legendMapper.map(mockData.charts, mockData.uncomputableValues)

	test.true(
		Array.isArray(result) && result.length == 2,
		'Should return an array of legend sections for term and overlay term'
	)
	test.deepEqual(result, legendMapper.legendData, 'Should return the same reference as legendData property')

	test.equal(
		result[0].label,
		`Descriptive Statistics: ${mockConfig1.term.term.name}`,
		'Should correctly set the first section label to match term.'
	)
	test.true(
		Array.isArray(result[0].items) && result[0].items.length > 0,
		'Should set the term section items as an array with at least 1 item.'
	)
	test.equal(
		result[1].label,
		`Descriptive Statistics: ${mockConfig1.term2.term.name}`,
		'Should correctly set the second section label to match overlay term.'
	)
	test.true(
		Array.isArray(result[1].items) && result[1].items.length > 0,
		'Should set the overlay section items as an array with at least 1 item.'
	)

	test.end()
})

tape('LegendDataMapper.setDescrStatItems() sets the correct legend items', function (test) {
	test.timeoutAfter(100)

	const { mockConfig1 } = getBoxPlotMockData()
	const legendMapper = new LegendDataMapper(mockConfig1)

	const result = legendMapper.setDescrStatItems(mockConfig1.term2.q.descrStats)
	const expected = [
		{ key: 'min', text: 'Min: 0', isHidden: false, isPlot: false },
		{ key: 'max', text: 'Max: 60', isHidden: false, isPlot: false },
		{ key: 'median', text: 'Median: 30', isHidden: false, isPlot: false },
		{ key: 'total', text: 'Total: 2', isHidden: false, isPlot: false }
	]
	test.deepEqual(result, expected, `Should properly set legend items for term2's descriptive statistics`)

	test.end()
})

tape('LegendDataMapper.getHiddenPlots() returns correct hidden plots', function (test) {
	test.timeoutAfter(100)

	const { mockConfig1, mockData } = getBoxPlotMockData()
	const legendMapper = new LegendDataMapper(mockConfig1)

	const hiddenPlots1 = legendMapper.getHiddenPlots(mockData.charts)
	const expected1 = []
	test.deepEqual(hiddenPlots1, expected1, 'Should return the correct hidden plots')

	mockData.charts['Acute lymphoblastic leukemia'].plots[0].isHidden = true
	mockData.charts['Acute lymphoblastic leukemia'].plots[1].isHidden = true

	const hiddenPlots2 = legendMapper.getHiddenPlots(mockData.charts)
	const expected2 = [
		{ key: 'Male', text: 'Male', isHidden: true, isPlot: true },
		{ key: 'Female', text: 'Female', isHidden: true, isPlot: true }
	]
	test.deepEqual(hiddenPlots2, expected2, 'Should return the correct hidden plots')

	test.end()
})

tape(
	'LegendDataMapper.setHiddenCategoryItems() returns the correct legend items per hidden plots and uncomputatble values',
	function (test) {
		test.timeoutAfter(100)

		const { mockConfig2 } = getBoxPlotMockData()
		const legendMapper = new LegendDataMapper(mockConfig2)

		//Not plot and value not applicable to term: diaggrp
		const mockHiddenPlots = [{ key: '1', text: '1', isHidden: true, isPlot: true }]
		const mockUncomputableValues = [{ label: 'test', value: 1 }]

		const result = legendMapper.setHiddenCategoryItems(mockConfig2.term, '1', mockHiddenPlots, mockUncomputableValues)

		test.equal(result, null, 'Should return null when plot is hidden and uncomputable value is not a valid term value')

		test.end()
	}
)
