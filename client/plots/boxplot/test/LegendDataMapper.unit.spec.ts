// import { LegendDataMapper } from '../viewModel/LegendDataMapper'
// import { getBoxPlotMockData } from './mockBoxPlotData'
// import { termjson } from '../../../test/testdata/termjson'

import tape from 'tape'

/*
Tests:
	Default LegendDataMapper

See unit tests for #dom/boxplot for rendering unit tests
*/

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/viewModel/LegendDataMapper -***-')
	test.end()
})

tape('Default LegendDataMapper', function (test) {
	// test.timeoutAfter(100)
	// let expected: { key: string; text: string; isHidden: boolean; isPlot: boolean }[]
	// const { mockData, mockConfig } = getBoxPlotMockData()
	// const legendData = new LegendDataMapper(mockConfig, mockData, mockData.plots).legendData
	// // const legend = viewModel.setLegendData(mockConfig, mockData)
	// if (!legendData) return test.fail('Should create a legend object')

	// test.equal(legendData.length, 2, `Should create 2 legend sections`)

	// test.true(
	// 	legendData[0].label.includes(termjson['agedx'].name),
	// 	`Should create descriptive stats section for ${termjson['agedx'].name}`
	// )

	// expected = [
	// 	{ key: 'min', text: 'Min: 20', isHidden: false, isPlot: false },
	// 	{ key: 'max', text: 'Max: 100', isHidden: false, isPlot: false },
	// 	{ key: 'median', text: 'Median: 60', isHidden: false, isPlot: false }
	// ]

	// test.deepEqual(legendData[0].items, expected, `Should properly set legend items`)

	// test.true(
	// 	legendData[1].label.includes(termjson['sex'].name),
	// 	`Should create descriptive stats section for ${termjson['sex'].name}`
	// )
	// expected = [
	// 	{ key: 'min', text: 'Min: 0', isHidden: false, isPlot: false },
	// 	{ key: 'max', text: 'Max: 60', isHidden: false, isPlot: false },
	// 	{ key: 'median', text: 'Median: 30', isHidden: false, isPlot: false }
	// ]
	// test.deepEqual(legendData[1].items, expected, `Should properly set legend items`)

	test.end()
})
