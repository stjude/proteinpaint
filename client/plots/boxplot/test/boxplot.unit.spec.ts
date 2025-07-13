import type { MassAppApi } from '#mass/types/mass'
import tape from 'tape'
import { termjson } from '../../../test/testdata/termjson'
import { ViewModel } from '../viewModel/ViewModel'
import { LegendDataMapper } from '../viewModel/LegendDataMapper'
import { ListSamples } from '../interactions/ListSamples'

/*
Tests:
	Default ViewModel()
	ViewModel.setPlotDimensions()
	ViewModel.setPlotData()
	Default LegendDataMapper()
	Default ListSamples()
	ListSamples() with invalid plot

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

const mockSettings = {
	boxplotWidth: 20,
	color: 'blue',
	displayMode: 'default',
	labelPad: 10,
	isLogScale: false,
	isVertical: false,
	orderByMedian: false,
	rowHeight: 20,
	rowSpace: 10,
	useDefaultSettings: true
}

const mockConfig = {
	chartType: 'summary',
	childType: 'boxplot',
	groups: [],
	id: 'test_test',
	term: { term: termjson['agedx'], q: { mode: 'continuous', descrStats: mockDescrStats1 } },
	term2: { term: termjson['sex'], q: { descrStats: mockDescrStats2 } },
	settings: { boxplot: mockSettings }
}

const mockPlot1 = {
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
	labColor: 'black',
	color: 'blue',
	descrStats: mockDescrStats1,
	x: 278,
	y: 155
}

const mockPlot2 = {
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
	labColor: 'black',
	color: '#e75480',
	descrStats: mockDescrStats2,
	x: 278,
	y: 155
}

const mockData = {
	absMin: 0,
	absMax: 100,
	plots: [mockPlot1, mockPlot2],
	uncomputableValues: [{ label: 'test', value: 1 }]
}

function getViewModel() {
	return new ViewModel(mockConfig, mockData, mockSettings, 400, false)
}

tape('\n', function (test) {
	test.comment('-***- plots/boxplot/ViewModel -***-')
	test.end()
})

tape('Default ViewModel()', function (test) {
	test.timeoutAfter(100)

	const viewModel = getViewModel()
	test.equal(typeof viewModel.viewData, 'object', `Should create a viewData object`)
	test.equal(typeof viewModel.viewData.plotDim, 'object', `Should create a plotDim object`)
	test.equal(viewModel.viewData.plots.length, 2, `Should create 2 plots`)
	test.equal(typeof viewModel.viewData.legend, 'object', `Should create a legend object`)

	test.end()
})

tape('ViewModel.setPlotDimensions()', function (test) {
	test.timeoutAfter(100)
	const viewModel = getViewModel()
	const dims = viewModel.setPlotDimensions(mockData, mockConfig, mockSettings)
	const expected = {
		domain: [0, 101],
		incrTopPad: 40,
		svg: {
			width: 490,
			height: 250
		},
		title: { x: 420, y: 85, text: 'Age at Cancer Diagnosis' },
		axis: { x: 410, y: 170 }
	}
	test.equal(typeof dims, 'object', `Should create a plotDim object`)
	test.deepEqual(dims.domain, expected.domain, `Should set domain = ${expected.domain}`)
	test.equal(dims.svg.width, expected.svg.width, `Should set svg.width = ${expected.svg.width}`)
	test.equal(dims.svg.height, expected.svg.height, `Should set svg.height = ${expected.svg.height}`)
	test.equal(dims.title.x, expected.title.x, `Should set title.x = ${expected.title.x}`)
	test.equal(dims.title.y, expected.title.y, `Should set title.y = ${expected.title.y}`)
	test.equal(dims.title.text, expected.title.text, `Should set title text = ${expected.title.text}`)
	test.equal(dims.axis.x, expected.axis.x, `Should set yAxis.x = ${expected.axis.x}`)
	test.equal(dims.axis.y, expected.axis.y, `Should set yAxis.y = ${expected.axis.y}`)

	test.end()
})

tape('ViewModel.setPlotData()', function (test) {
	test.timeoutAfter(100)

	const viewModel = getViewModel()
	const plots = viewModel.setPlotData(mockData, mockConfig, mockSettings)

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
		plots[1].x == plots[0].x && plots[1].y == plots[0].y + 30,
		`Should set x the same for all plots and increment y`
	)

	test.end()
})

tape('Default LegendDataMapper', function (test) {
	test.timeoutAfter(100)
	let expected: { key: string; text: string; isHidden: boolean; isPlot: boolean }[]
	const legendData = new LegendDataMapper(mockConfig, mockData, mockData.plots).legendData
	// const legend = viewModel.setLegendData(mockConfig, mockData)
	if (!legendData) return test.fail('Should create a legend object')

	test.equal(legendData.length, 2, `Should create 2 legend sections`)

	test.true(
		legendData[0].label.includes(termjson['agedx'].name),
		`Should create descriptive stats section for ${termjson['agedx'].name}`
	)

	expected = [
		{ key: 'min', text: 'Min: 20', isHidden: false, isPlot: false },
		{ key: 'max', text: 'Max: 100', isHidden: false, isPlot: false },
		{ key: 'median', text: 'Median: 60', isHidden: false, isPlot: false }
	]

	test.deepEqual(legendData[0].items, expected, `Should properly set legend items`)

	test.true(
		legendData[1].label.includes(termjson['sex'].name),
		`Should create descriptive stats section for ${termjson['sex'].name}`
	)
	expected = [
		{ key: 'min', text: 'Min: 0', isHidden: false, isPlot: false },
		{ key: 'max', text: 'Max: 60', isHidden: false, isPlot: false },
		{ key: 'median', text: 'Median: 30', isHidden: false, isPlot: false }
	]
	test.deepEqual(legendData[1].items, expected, `Should properly set legend items`)

	test.end()
})

tape('Default ListSamples()', test => {
	test.plan(7)

	const mockApp: MassAppApi = {} as MassAppApi
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
	const mockApp: MassAppApi = {} as MassAppApi
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
	const mockApp: MassAppApi = {} as MassAppApi
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
							},
							less: {
								type: 'regular-bin',
								label_offset: 1,
								bin_size: 5,
								first_bin: { startunbounded: true, stop: 5 },
								last_bin: { stopunbounded: true, start: 15 }
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
