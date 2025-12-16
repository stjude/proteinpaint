import tape from 'tape'
import { getBoxPlotMockData } from './mockBoxPlotData'
import { ChartsDataMapper, getChartSubtitle } from '../viewModel/ChartsDataMapper'
import { termjson } from '../../../test/testdata/termjson'

/*
Tests:
	- Default ChartsDataMapper constructor with default settings
	- Default ChartsDataMapper constructor with default settings user defined settings
	- ChartsDataMapper.getRowSettings() returns row settings for default settings
	-- map()
	- ChartsDataMapper.setPlotDimensions() returns the correct plot dimensions for 1 chart (i.e. no divide by term applied)
	- ChartsDataMapper.setSvgDimensions() returns the correct svg dimensions
	- ChartsDataMapper.setSubtitleDimensions() returns null when term0 is not set
	- ChartsDataMapper.setSubtitleDimensions() returns correct subtitle dimensions when term0 is set
	--setTitleDimensions
	--filterTickValues
	setPlotData()
	- getChartSubtitle() returns the correct subtitle with no divide by term (i.e. term0)
	- getChartSubtitle() returns the correct subtitle with divide by term
*/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/viewModel/ChartsDataMapper -***-')
	test.end()
})

tape('Default ChartsDataMapper constructor with default settings', function (test) {
	test.timeoutAfter(100)

	const { mockData, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)

	test.equal(typeof chartsMapper, 'object', 'Should create a ChartsDataMapper object')
	test.equal(chartsMapper.absMin, mockData.absMin, `Should set absMin = ${mockData.absMin}`)
	test.equal(chartsMapper.absMax, mockData.absMax, `Should set absMax = ${mockData.absMax}`)
	test.equal(typeof chartsMapper.charts, 'object', `Should create charts object`)
	test.equal(chartsMapper.rowHeight, 50, `Should set rowHeight = 50`)
	test.equal(chartsMapper.rowSpace, 15, `Should set rowSpace = 15`)
	test.deepEqual(chartsMapper.settings, mockSettings, `Should set correct settings object`)
	test.equal(chartsMapper.totalBoxSize, 65, `Should set totalBoxSize = 65`)
	test.equal(chartsMapper.totalLabelSize, 110, `Should set totalLabelSize = 110`)
	test.end()
})

tape('Default ChartsDataMapper constructor with default settings user defined settings', function (test) {
	test.timeoutAfter(100)

	const { mockData, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, false)

	//Only the row settings should differ from the previous test
	test.equal(chartsMapper.rowHeight, 20, `Should set rowHeight = 20`)
	test.equal(chartsMapper.rowSpace, 10, `Should set rowSpace = 10`)

	test.end()
})

tape('ChartsDataMapper.getRowSettings() returns correct row settings', function (test) {
	test.timeoutAfter(100)

	const { mockData, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)
	const rowSettings = chartsMapper.getRowSettings(chartsMapper.charts)

	test.equal(rowSettings.rowHeight, 50, `Should set rowHeight = 50`)
	test.equal(rowSettings.rowSpace, 15, `Should set rowSpace = 15`)

	test.end()
})

tape.skip('ChartsDataMapper.map()', function (test) {
	test.timeoutAfter(100)
	test.end()
})

tape(
	'ChartsDataMapper.setPlotDimensions() returns the correct plot dimensions for 1 chart (i.e. no divide by term applied)',
	function (test) {
		test.timeoutAfter(100)

		const { mockData, mockConfig1, mockSettings } = getBoxPlotMockData()
		const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)

		const result = chartsMapper.setPlotDimensions(
			mockData.charts['Acute lymphoblastic leukemia'],
			mockConfig1,
			mockSettings,
			0
		)

		const expected = {
			axis: {
				x: 110,
				y: 40,
				format: () => {
					//Leave blank
				},
				values: () => {
					//Leave blank
				}
			},
			domain: [0, 101],
			range: [0, 20],
			subtitle: { x: null, y: null, text: null },
			svg: {
				width: 190,
				height: 175
			},
			title: { x: 120, y: 20, text: 'Age at Cancer Diagnosis' }
		}
		test.equal(typeof result, 'object', `Should create a plotDim object`)
		test.deepEqual(result.domain, expected.domain, `Should set domain = ${expected.domain}`)
		test.deepEqual(result.range, expected.range, `Should set range = ${expected.range}`)
		test.deepEqual(result.subtitle, expected.subtitle, `Should set subtitle to null values when term0 is not set.`)
		test.deepEqual(result.svg, expected.svg, `Should set svg dimensions correctly.`)
		test.deepEqual(result.title, expected.title, `Should set title dimensions correctly.`)
		test.equal(result.axis.x, expected.axis.x, `Should set yAxis.x = ${expected.axis.x}`)
		test.equal(result.axis.y, expected.axis.y, `Should set yAxis.y = ${expected.axis.y}`)
		//Not testing axis.format or axis.values functions here

		test.end()
	}
)

tape('ChartsDataMapper.setSvgDimensions() returns the correct svg dimensions', function (test) {
	test.timeoutAfter(100)
	const { mockData, mockConfig1, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)

	const result = chartsMapper.setSvgDimensions(
		mockSettings,
		mockData.charts['Acute lymphoblastic leukemia'],
		0,
		mockConfig1
	)

	const expected = {
		width: 190,
		height: 175
	}

	test.equal(typeof result, 'object', `Should create a svg dimensions object`)
	test.deepEqual(result, expected, `Should set svg dimensions correctly.`)

	test.end()
})

tape('ChartsDataMapper.setSubtitleDimensions() returns null when term0 is not set', function (test) {
	test.timeoutAfter(100)

	const { mockData, mockConfig1, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)
	const result = chartsMapper.setSubtitleDimensions(
		mockConfig1,
		mockSettings,
		175,
		'Acute lymphoblastic leukemia',
		2,
		95,
		0
	)

	const expected = {
		x: null,
		y: null,
		text: null
	}

	test.equal(typeof result, 'object', `Should create a subtitle dimensions object of null values`)
	test.deepEqual(result, expected, `Should set subtitle to null values when term0 is not set.`)

	test.end()
})

tape('ChartsDataMapper.setSubtitleDimensions() returns correct subtitle dimensions when term0 is set', function (test) {
	test.timeoutAfter(100)

	const { mockData, mockConfig1, mockSettings } = getBoxPlotMockData()
	const chartsMapper = new ChartsDataMapper(mockData, mockSettings, 100, true)
	mockConfig1['term0'] = { term: termjson['diaggrp'] }

	const result = chartsMapper.setSubtitleDimensions(mockConfig1, mockSettings, 175, 'test', 2, 95, 0)

	const expected = { x: 95, y: 20, text: 'test (n=2)' }

	test.equal(typeof result, 'object', `Should create a subtitle dimensions object for divide by term`)
	test.deepEqual(result, expected, `Should calcualte subtitle dimensions correctly.`)

	test.end()
})

tape.skip('ChartsDataMapper.setTitleDimensions()', function (test) {
	test.timeoutAfter(100)
	test.end()
})

tape.skip('ChartsDataMapper.filterTickValues()', function (test) {
	test.timeoutAfter(100)
	test.end()
})

tape.skip('ChartsDataMapper.setPlotData()', function (test) {
	test.timeoutAfter(100)

	// const { viewModel, mockData, mockConfig, mockSettings } = getViewModel()
	// const plots = viewModel.setPlotData(mockData, mockConfig, mockSettings)

	// test.equal(
	// 	plots[0].color,
	// 	termjson['sex'].values[1].color,
	// 	`Should set first box plot color = ${termjson['sex'].values[1].color}`
	// )
	// test.equal(
	// 	plots[1].color,
	// 	termjson['sex'].values[2].color,
	// 	`Should set second box plot color = ${termjson['sex'].values[2].color}`
	// )

	// test.true(
	// 	plots[0].boxplot.radius == 5 && !plots[1].boxplot.radius,
	// 	`Should set a radius for the first plot but not the second`
	// )

	// test.true(
	// 	plots[1].x == plots[0].x && plots[1].y == plots[0].y + 30,
	// 	`Should set x the same for all plots and increment y`
	// )

	test.end()
})

tape('getChartSubtitle() returns the correct subtitle with no divide by term (i.e. term0)', function (test) {
	test.timeoutAfter(100)
	const { mockConfig1 } = getBoxPlotMockData()
	const expectedSubtitle = 'Age at Cancer Diagnosis'
	const result = getChartSubtitle(mockConfig1, expectedSubtitle)
	test.equal(
		result,
		expectedSubtitle,
		`Should return subtitle = ${expectedSubtitle} when no divide by term is present.`
	)
	test.end()
})

tape('getChartSubtitle() returns the correct subtitle with divide by term', function (test) {
	test.timeoutAfter(100)
	const { mockConfig1 } = getBoxPlotMockData()
	mockConfig1['term0'] = { term: termjson['diaggrp'] }
	const expectedSubtitle = 'Acute lymphoblastic leukemia'
	const result = getChartSubtitle(mockConfig1, expectedSubtitle)
	test.equal(result, expectedSubtitle, `Should return subtitle = ${expectedSubtitle} when divide by term is present.`)
	test.end()
})
