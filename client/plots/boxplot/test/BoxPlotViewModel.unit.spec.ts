import tape from 'tape'
import { getBoxPlotMockData } from './mockBoxPlotData'
import { ViewModel } from '../viewModel/ViewModel'
/*
Tests:
	- Default ViewModel constructor

See unit tests for #dom/boxplot for rendering unit tests
*/

function getViewModel() {
	const { mockConfig1, mockData, mockSettings } = getBoxPlotMockData()
	return {
		viewModel: new ViewModel(mockConfig1, mockData, mockSettings, 400, false),
		mockConfig: mockConfig1,
		mockData,
		mockSettings
	}
}

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/viewModel/ViewModel -***-')
	test.end()
})

tape('Default ViewModel constructor', function (test) {
	test.timeoutAfter(100)

	const { viewModel } = getViewModel()
	test.equal(typeof viewModel.viewData, 'object', `Should create a viewData object`)
	test.true(
		typeof viewModel.viewData.backgroundColor === 'string' && viewModel.viewData.backgroundColor == 'white',
		`Should set a standard background color as white`
	)
	test.true(
		typeof viewModel.viewData.textColor === 'string' && viewModel.viewData.textColor == 'black',
		`Should set a standard text color as black`
	)
	test.equal(typeof viewModel.viewData.charts, 'object', `Should create a charts object`)
	test.equal(typeof viewModel.viewData.legend, 'object', `Should create a legend object`)

	test.end()
})
