import { termjson } from '../../../test/testdata/termjson'

const mockDescrStats1 = {
	min: { key: 'min', label: 'Min', value: 20 },
	max: { key: 'max', label: 'Max', value: 100 },
	median: { key: 'median', label: 'Median', value: 60 }
}

const mockDescrStats2 = {
	min: { key: 'min', label: 'Min', value: 0 },
	max: { key: 'max', label: 'Max', value: 60 },
	median: { key: 'median', label: 'Median', value: 30 }
}

const mockSettings = {
	plotLength: 20,
	color: 'blue',
	displayMode: 'default',
	labelPad: 10,
	isLogScale: false,
	isVertical: false,
	orderByMedian: false,
	rowHeight: 20,
	rowSpace: 10,
	useDefaultSettings: true,
	removeOutliers: false,
	showAssocTests: true
}

const mockConfig = {
	chartType: 'summary',
	childType: 'boxplot',
	groups: [],
	id: 'test_test',
	term: {
		term: JSON.parse(JSON.stringify(termjson['agedx'])),
		q: { mode: 'continuous', descrStats: mockDescrStats1 }
	},
	term2: { term: JSON.parse(JSON.stringify(termjson['sex'])), q: { descrStats: mockDescrStats2 } },
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
	color: '#e75480',
	descrStats: mockDescrStats2,
	x: 278,
	y: 155
}

const mockData: any = {
	chartId: '',
	plots: [mockPlot1, mockPlot2],
	absMin: 0,
	absMax: 100,
	uncomputableValues: [{ label: 'test', value: 1 }]
}

export function getBoxPlotMockData() {
	return { mockDescrStats1, mockDescrStats2, mockSettings, mockConfig, mockPlot1, mockPlot2, mockData }
}
