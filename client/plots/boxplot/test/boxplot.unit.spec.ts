import tape from 'tape'
import { termjson } from '../../../test/testdata/termjson'
import { ViewModel } from '../ViewModel'

/*
Tests:
    Default new ViewModel()


See unit tests for #dom/boxplot for rendering unit tests
*/

const mockConfig = {
	term: { term: termjson['agedx'] },
	term2: { term: termjson['sex'] }
}

const mockData = {
	maxLabelLgth: 10,
	plots: [
		{
			seriesId: '1',
			boxplot: {
				label: '1, n=1',
				min: 20,
				max: 100,
				out: []
			}
		},
		{
			seriesId: '2',
			boxplot: {
				label: '2, n=2',
				min: 0,
				max: 60,
				out: []
			}
		}
	]
}

const mockSettings = {
	boxplotWidth: 20,
	color: 'blue',
	labelPad: 10,
	rowHeight: 20,
	rowSpace: 10
}

tape('\n', function (test) {
	test.pass('-***- plots/boxplot -***-')
	test.end()
})

tape('Default new ViewModel()', function (test) {
	test.timeoutAfter(100)

	const viewModel: any = new ViewModel(mockConfig, mockData, mockSettings)

	test.equal(typeof viewModel.plotDim, 'object', 'Should create a plotDim object')
	test.equal(viewModel.plotDim.incrTopPad, 40, 'Should set incrTopPad to 40')
	test.equal(viewModel.plotDim.svgWidth, 280, 'Should set svgWidth to 280')
	test.equal(viewModel.plotDim.svgHeight, 160, 'Should set svgHeight to 160')
	test.equal(viewModel.plotDim.title.x, 150, 'Should set title.x to 150')
	test.equal(viewModel.plotDim.title.y, 40, 'Should set title.y to 40')
	test.equal(viewModel.plotDim.totalLabelWidth, 140, 'Should set totalLabelWidth to 140')
	test.equal(viewModel.plotDim.totalRowHeight, 30, 'Should set totalRowHeight to 30')
	test.equal(viewModel.plotDim.vertPad, 20, 'Should set vertPad to 20')
	test.equal(viewModel.plotDim.horizPad, 120, 'Should set horizPad to 120')
	test.equal(viewModel.plotDim.yAxis.x, 140, 'Should set yAxis.x to 140')
	test.equal(viewModel.plotDim.yAxis.y, 80, 'Should set yAxis.y to 80')
	test.equal(
		viewModel.plots[0].color,
		termjson['sex'].values[1].color,
		`Should set first box plot color to ${termjson['sex'].values[1].color}`
	)
	test.equal(
		viewModel.plots[1].color,
		termjson['sex'].values[2].color,
		`Should set second box plot color to ${termjson['sex'].values[1].color}`
	)

	test.end()
})
