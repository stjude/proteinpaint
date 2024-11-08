import tape from 'tape'
import { termjson } from '../../../test/testdata/termjson'
import { ViewModel } from '../ViewModel'

/*
Tests:
	Default new ViewModel() viewData
	Plot dimentions
	.setPlotData()
	.setLegendData()

See unit tests for #dom/boxplot for rendering unit tests
*/

const mockDescrStats1 = [
	{ id: 'min', label: 'Min', value: 20 },
	{ id: 'max', label: 'Max', value: 100 },
	{ id: 'median', label: 'Median', value: 60 }
]

const mockDescrStats2 = [
	{ id: 'min', label: 'Min', value: 0 },
	{ id: 'max', label: 'Max', value: 60 },
	{ id: 'median', label: 'Median', value: 30 }
]

const mockConfig = {
	term: { term: termjson['agedx'], q: { mode: 'continuous', descrStats: mockDescrStats1 } },
	term2: { term: termjson['sex'], q: { descrStats: mockDescrStats2 } }
}

const mockData = {
	maxLabelLgth: 10,
	absMin: 0,
	absMax: 100,
	plots: [
		{
			seriesId: '1',
			boxplot: {
				w1: 0.002739726,
				w2: 22.747930234,
				p05: 0.9205479452,
				p25: 3.4712328767,
				p50: 7.4410958904,
				p75: 11.78630137,
				p95: 16.849315068,
				iqr: 8.3150684933,
				out: [{ value: 1 }],
				label: '1, n=1'
			},
			color: 'blue',
			descrStats: mockDescrStats1,
			x: 278,
			y: 155
		},
		{
			seriesId: '2',
			boxplot: {
				w1: 0.002739726,
				w2: 22.747930234,
				p05: 0.9205479452,
				p25: 3.4712328767,
				p50: 7.4410958904,
				p75: 11.78630137,
				p95: 16.849315068,
				iqr: 8.3150684933,
				out: [],
				label: '2, n=2'
			},
			color: '#e75480',
			descrStats: mockDescrStats2,
			x: 278,
			y: 155
		}
	],
	uncomputableValues: [{ label: 'test', value: 1 }]
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

	const viewModel = new ViewModel(mockConfig, mockData, mockSettings)
	test.equal(typeof viewModel.viewData, 'object', `Should create a viewData object`)
	test.equal(typeof viewModel.viewData.plotDim, 'object', `Should create a plotDim object`)
	test.equal(viewModel.viewData.plots.length, 2, `Should create 2 plots`)
	test.equal(typeof viewModel.viewData.legend, 'object', `Should create a legend object`)

	test.end()
})

tape('Plot dimentions', function (test) {
	test.timeoutAfter(100)

	const viewModel = new ViewModel(mockConfig, mockData, mockSettings)
	const viewData = viewModel.viewData
	const expected = {
		plotDim: {
			domain: [0, 101],
			incrTopPad: 40,
			svgWidth: 310,
			svgHeight: 160,
			title: { x: 180, y: 40, text: 'Age at Cancer Diagnosis' },
			yAxis: { x: 170, y: 80 }
		}
	}
	test.equal(typeof viewData.plotDim, 'object', `Should create a plotDim object`)
	test.deepEqual(viewData.plotDim.domain, expected.plotDim.domain, `Should set domain = ${expected.plotDim.domain}`)
	test.equal(viewData.plotDim.svgWidth, expected.plotDim.svgWidth, `Should set svgWidth = ${expected.plotDim.svgWidth}`)
	test.equal(
		viewData.plotDim.svgHeight,
		expected.plotDim.svgHeight,
		`Should set svgHeight = ${expected.plotDim.svgHeight}`
	)
	test.equal(viewData.plotDim.title.x, expected.plotDim.title.x, `Should set title.x = ${expected.plotDim.title.x}`)
	test.equal(viewData.plotDim.title.y, expected.plotDim.title.y, `Should set title.y = ${expected.plotDim.title.y}`)
	test.equal(
		viewData.plotDim.title.text,
		expected.plotDim.title.text,
		`Should set title text = ${expected.plotDim.title.text}`
	)
	test.equal(viewData.plotDim.yAxis.x, expected.plotDim.yAxis.x, `Should set yAxis.x = ${expected.plotDim.yAxis.x}`)
	test.equal(viewData.plotDim.yAxis.y, expected.plotDim.yAxis.y, `Should set yAxis.y = ${expected.plotDim.yAxis.y}`)

	test.end()
})

tape('.setPlotData()', function (test) {
	test.timeoutAfter(100)

	const viewModel = new ViewModel(mockConfig, mockData, mockSettings)
	const plots = viewModel.setPlotData(mockData, mockConfig, mockSettings, 100, 300)

	test.equal(
		plots[0].color,
		termjson['sex'].values[1].color,
		`Should set first box plot color = ${termjson['sex'].values[1].color}`
	)
	test.equal(
		plots[1].color,
		termjson['sex'].values[2].color,
		`Should set second box plot color = ${termjson['sex'].values[2].color}`
	)

	test.true(
		plots[0].boxplot.radius == 5 && !plots[1].boxplot.radius,
		`Should set a radius for the first plot but not the second`
	)

	test.true(
		plots[1].x == plots[0].x && plots[1].y == plots[0].y + 300,
		`Should set x the same for all plots and increment y`
	)

	test.end()
})

tape('.setLegendData()', function (test) {
	test.timeoutAfter(100)

	const viewModel = new ViewModel(mockConfig, mockData, mockSettings)
	const legend = viewModel.setLegendData(mockConfig, mockData)

	test.equal(legend.length, 3, `Should create 3 legend sections`)

	test.true(
		legend[0].label.includes(termjson['agedx'].name),
		`Should create descriptive stats section for ${termjson['agedx'].name}`
	)
	test.deepEqual(legend[0].items, mockConfig.term.q.descrStats, `Should properly set legend items`)

	test.true(
		legend[1].label.includes(termjson['sex'].name),
		`Should create descriptive stats section for ${termjson['sex'].name}`
	)
	test.deepEqual(legend[1].items, mockConfig.term2.q.descrStats, `Should properly set legend items`)

	test.equal(legend[2].label, 'Other categories', `Should create section for uncomputatable values`)
	test.deepEqual(legend[2].items, mockData.uncomputableValues, `Should properly set legend items`)

	test.end()
})
