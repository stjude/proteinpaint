import tape from 'tape'
import { getBoxPlotMockData } from './mockBoxPlotData'
import { ViewModel } from '../viewModel/ViewModel'
// import { termjson } from '../../../test/testdata/termjson'

/*
Tests:
	Default ViewModel()
	ViewModel.setPlotDimensions()
	ViewModel.setPlotData()

See unit tests for #dom/boxplot for rendering unit tests
*/

function getViewModel() {
	const { mockConfig, mockData, mockSettings } = getBoxPlotMockData()
	return {
		viewModel: new ViewModel(mockConfig, mockData, mockSettings, 400, false),
		mockConfig,
		mockData,
		mockSettings
	}
}

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/viewModel/ViewModel -***-')
	test.end()
})

tape('Default ViewModel()', function (test) {
	test.timeoutAfter(100)

	const { viewModel } = getViewModel()
	test.equal(typeof viewModel.viewData, 'object', `Should create a viewData object`)
	// test.equal(typeof viewModel.viewData.plotDim, 'object', `Should create a plotDim object`)
	// test.equal(viewModel.viewData.plots.length, 2, `Should create 2 plots`)
	test.equal(typeof viewModel.viewData.legend, 'object', `Should create a legend object`)

	test.end()
})

tape('ViewModel.setPlotDimensions()', function (test) {
	test.timeoutAfter(100)
	// const { viewModel, mockData, mockConfig, mockSettings } = getViewModel()
	// const dims = viewModel.setPlotDimensions(mockData, mockConfig, mockSettings)
	// const expected = {
	// 	domain: [0, 101],
	// 	incrTopPad: 40,
	// 	svg: {
	// 		width: 490,
	// 		height: 250
	// 	},
	// 	title: { x: 420, y: 85, text: 'Age at Cancer Diagnosis' },
	// 	axis: { x: 410, y: 170 }
	// }
	// test.equal(typeof dims, 'object', `Should create a plotDim object`)
	// test.deepEqual(dims.domain, expected.domain, `Should set domain = ${expected.domain}`)
	// test.equal(dims.svg.width, expected.svg.width, `Should set svg.width = ${expected.svg.width}`)
	// test.equal(dims.svg.height, expected.svg.height, `Should set svg.height = ${expected.svg.height}`)
	// test.equal(dims.title.x, expected.title.x, `Should set title.x = ${expected.title.x}`)
	// test.equal(dims.title.y, expected.title.y, `Should set title.y = ${expected.title.y}`)
	// test.equal(dims.title.text, expected.title.text, `Should set title text = ${expected.title.text}`)
	// test.equal(dims.axis.x, expected.axis.x, `Should set yAxis.x = ${expected.axis.x}`)
	// test.equal(dims.axis.y, expected.axis.y, `Should set yAxis.y = ${expected.axis.y}`)

	test.end()
})

tape('ViewModel.setPlotData()', function (test) {
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
