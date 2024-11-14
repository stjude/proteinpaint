import tape from 'tape'
import { termjson } from '../../../test/testdata/termjson'
import { ViewModel } from '../viewModel/ViewModel'

/*
Tests:
	Default new ViewModel() viewData
	.setPlotDimensions()
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
	term2: { term: termjson['sex'], q: { descrStats: mockDescrStats2 } },
	settings: { boxplot: { useDefaultSettings: true } }
}

const mockData = {
	absMin: 0,
	absMax: 100,
	plots: [
		{
			key: '1',
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
			key: '2',
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
	rowSpace: 10,
	useDefaultSettings: true
}

function getViewModel() {
	return new ViewModel(mockConfig, mockData, mockSettings, 400)
}

tape('\n', function (test) {
	test.pass('-***- plots/boxplot/ViewModel -***-')
	test.end()
})

tape('Default new ViewModel()', function (test) {
	test.timeoutAfter(100)

	const viewModel = getViewModel()
	test.equal(typeof viewModel.viewData, 'object', `Should create a viewData object`)
	test.equal(typeof viewModel.viewData.plotDim, 'object', `Should create a plotDim object`)
	test.equal(viewModel.viewData.plots.length, 2, `Should create 2 plots`)
	test.equal(typeof viewModel.viewData.legend, 'object', `Should create a legend object`)

	test.end()
})

tape('.setPlotDimensions()', function (test) {
	test.timeoutAfter(100)
	const viewModel = getViewModel()
	const dims = viewModel.setPlotDimensions(mockData, mockConfig, mockSettings, 170, 30)
	const expected = {
		domain: [0, 101],
		incrTopPad: 40,
		svgWidth: 310,
		svgHeight: 250,
		title: { x: 180, y: 85, text: 'Age at Cancer Diagnosis' },
		yAxis: { x: 170, y: 170 }
	}
	test.equal(typeof dims, 'object', `Should create a plotDim object`)
	test.deepEqual(dims.domain, expected.domain, `Should set domain = ${expected.domain}`)
	test.equal(dims.svgWidth, expected.svgWidth, `Should set svgWidth = ${expected.svgWidth}`)
	test.equal(dims.svgHeight, expected.svgHeight, `Should set svgHeight = ${expected.svgHeight}`)
	test.equal(dims.title.x, expected.title.x, `Should set title.x = ${expected.title.x}`)
	test.equal(dims.title.y, expected.title.y, `Should set title.y = ${expected.title.y}`)
	test.equal(dims.title.text, expected.title.text, `Should set title text = ${expected.title.text}`)
	test.equal(dims.yAxis.x, expected.yAxis.x, `Should set yAxis.x = ${expected.yAxis.x}`)
	test.equal(dims.yAxis.y, expected.yAxis.y, `Should set yAxis.y = ${expected.yAxis.y}`)

	test.end()
})

tape('.setPlotData()', function (test) {
	test.timeoutAfter(100)

	const viewModel = getViewModel()
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

	const viewModel = getViewModel()
	const legend = viewModel.setLegendData(mockConfig, mockData)
	if (!legend) return test.fail('Should create a legend object')

	test.equal(legend.length, 2, `Should create 3 legend sections`)

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

	test.end()
})
