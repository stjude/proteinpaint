import { termjson } from '../../../test/testdata/termjson'

/** Do not export these consts individually.
 * Instead, use a copy to avoid altering the
 * original test termjson term obj.*/
export function getBoxPlotMockData() {
	const mockDescrStats1 = {
		min: { key: 'min', label: 'Min', value: 20 },
		max: { key: 'max', label: 'Max', value: 100 },
		median: { key: 'median', label: 'Median', value: 60 },
		total: { key: 'total', label: 'Total', value: 2 }
	}

	const mockDescrStats2 = {
		min: { key: 'min', label: 'Min', value: 0 },
		max: { key: 'max', label: 'Max', value: 60 },
		median: { key: 'median', label: 'Median', value: 30 },
		total: { key: 'total', label: 'Total', value: 2 }
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

	//term: agedx && overlay: sex
	const mockConfig1 = {
		chartType: 'summary',
		childType: 'boxplot',
		id: 'test_test',
		term: {
			term: JSON.parse(JSON.stringify(termjson['agedx'])),
			q: { mode: 'continuous', descrStats: mockDescrStats1 }
		},
		term2: { term: JSON.parse(JSON.stringify(termjson['sex'])), q: { descrStats: mockDescrStats2 } },
		settings: { boxplot: mockSettings }
	}

	//term: diaggrp && overlay: sex
	const mockConfig2 = {
		chartType: 'summary',
		childType: 'boxplot',
		id: 'test_test',
		term: {
			term: JSON.parse(JSON.stringify(termjson['diaggrp'])),
			q: { mode: 'continuous', descrStats: mockDescrStats1 }
		},
		term2: { term: JSON.parse(JSON.stringify(termjson['sex'])), q: { descrStats: mockDescrStats2 } },
		settings: { boxplot: mockSettings }
	}

	const mockPlot1 = {
		key: 'Male',
		seriesId: '1',
		chartId: '',
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
		key: 'Female',
		seriesId: '2',
		chartId: '',
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
		y: 155,
		overlayTwBins: null
	}

	//Mock data for mockConfig2
	const mockData: any = {
		absMin: 0,
		absMax: 100,
		bins: {
			term1: {},
			term2: {}
		},
		charts: {
			'Acute lymphoblastic leukemia': {
				chartId: '1',
				plots: [mockPlot1, mockPlot2],
				sampleCount: 2
			}
		},
		descrStats: mockDescrStats1,
		uncomputableValues: [{ label: 'test', value: 1 }]
	}

	const mockFilter = {
		in: true,
		join: '',
		tag: 'filterUiRoot',
		type: 'tvslst',
		lst: []
	}

	return {
		mockDescrStats1,
		mockDescrStats2,
		mockSettings,
		mockConfig1,
		mockConfig2,
		mockPlot1,
		mockPlot2,
		mockData,
		mockFilter
	}
}
