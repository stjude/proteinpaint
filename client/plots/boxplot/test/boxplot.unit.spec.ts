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
	absMin: 0,
	absMax: 100,
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
	test.pass('-***- plots/boxplot/ViewModel -***-')
	test.end()
})

tape('Default new ViewModel()', function (test) {
	test.timeoutAfter(100)

	const viewModel: any = new ViewModel(mockConfig, mockData, mockSettings)
	const expected = {
		plotDim: {
			domain: [0, 101],
			incrTopPad: 40,
			svgWidth: 340,
			svgHeight: 160,
			title: { x: 180, y: 40 },
			yAxis: { x: 170, y: 80 }
		}
	}
	test.equal(typeof viewModel.plotDim, 'object', `Should create a plotDim object`)
	test.deepEqual(viewModel.plotDim.domain, expected.plotDim.domain, `Should set domain = ${expected.plotDim.domain}`)
	test.equal(
		viewModel.plotDim.incrTopPad,
		expected.plotDim.incrTopPad,
		`Should set incrTopPad = ${expected.plotDim.incrTopPad}`
	)
	test.equal(
		viewModel.plotDim.svgWidth,
		expected.plotDim.svgWidth,
		`Should set svgWidth = ${expected.plotDim.svgWidth}`
	)
	test.equal(
		viewModel.plotDim.svgHeight,
		expected.plotDim.svgHeight,
		`Should set svgHeight = ${expected.plotDim.svgHeight}`
	)
	test.equal(viewModel.plotDim.title.x, expected.plotDim.title.x, `Should set title.x = ${expected.plotDim.title.x}`)
	test.equal(viewModel.plotDim.title.y, expected.plotDim.title.y, `Should set title.y = ${expected.plotDim.title.y}`)
	test.equal(viewModel.plotDim.yAxis.x, expected.plotDim.yAxis.x, `Should set yAxis.x = ${expected.plotDim.yAxis.x}`)
	test.equal(viewModel.plotDim.yAxis.y, expected.plotDim.yAxis.y, `Should set yAxis.y = ${expected.plotDim.yAxis.y}`)
	test.equal(
		viewModel.plots[0].color,
		termjson['sex'].values[1].color,
		`Should set first box plot color = ${termjson['sex'].values[1].color}`
	)
	test.equal(
		viewModel.plots[1].color,
		termjson['sex'].values[2].color,
		`Should set second box plot color = ${termjson['sex'].values[2].color}`
	)

	test.end()
})
