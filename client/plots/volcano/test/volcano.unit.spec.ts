import tape from 'tape'
import * as testData from './testData'
import { VolcanoViewModel } from '../viewModel/VolcanoViewModel'
// import { scaleLinear } from 'd3-scale'

/* Tests:
    - init VolcanoViewModel
    - setDataType
    - setMinMaxValues
    - setPlotDimensions
    - setPointData
    - setStatsData
	- setUserActions
*/

const mockSettings = {
	defaultSignColor: 'red',
	defaultNonSignColor: 'black',
	defaultHighlightColor: '#ffa200',
	foldChangeCutoff: 0,
	height: 400,
	method: 'edgeR',
	minCount: 10,
	minTotalCount: 15,
	pValue: 1.3,
	pValueType: 'adjusted',
	rankBy: 'abs(foldChange)',
	showImages: false,
	showPValueTable: false,
	width: 400
}

const mockConfig = {
	confounderTws: [],
	highlightedData: [],
	settings: {
		volcano: mockSettings
	},
	termType: 'geneExpression',
	samplelst: {
		groups: testData.groups
	},
	tw: {
		q: {
			groups: testData.groups
		},
		term: {
			name: 'Sensitive vs Resistant',
			type: 'samplelst',
			values: {
				Sensitive: {
					color: '#1b9e77',
					key: 'Sensitive',
					label: 'Sensitive',
					list: testData.group1Values
				},
				Resistant: {
					color: '#d95f02',
					key: 'Resistant',
					label: 'Resistant',
					list: testData.group2Values
				}
			}
		}
	}
}

const mockResponse = {
	data: testData.responseData,
	images: [],
	method: 'edgeR',
	sample_size1: 3,
	sample_size2: 3
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/Volcano -***-')
	test.end()
})

tape('init VolcanoViewModel', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)
	test.equal(viewModel.config, mockConfig, `Should properly set config`)
	test.equal(viewModel.response, mockResponse, `Should properly set response`)
	test.equal(viewModel.settings, mockSettings, `Should properly set settings`)
	test.equal(viewModel.pValueCutoff, mockSettings.pValue, `Should properly set pValueCutoff`)
	test.equal(viewModel.termType, mockConfig.termType, 'Should properly set termType')
	test.equal(viewModel.numSignificant, 1, 'Should properly set numSignificant')
	test.equal(viewModel.numNonSignificant, 9, 'Should properly set numNonSignificant')

	test.end()
})

tape('setDataType', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	viewModel.setDataType()
	test.equal(viewModel.dataType, 'genes', 'Should properly set dataType')

	test.end()
})

tape('setMinMaxValues', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	viewModel.setMinMaxValues()
	test.equal(viewModel.minLogFoldChange, -0.1281, 'Should properly set minLogFoldChange')
	test.equal(viewModel.maxLogFoldChange, 0.6196, 'Should properly set maxLogFoldChange')
	test.equal(viewModel.minLogPValue, -0.192065410979292, 'Should properly set minLogPValue')
	test.equal(viewModel.maxLogPValue, 2.677780705266081, 'Should properly set maxLogPValue')
	test.equal(viewModel.minNonZeroPValue, 1e-9, 'Should properly set minNonZeroPValue')

	test.end()
})

tape('setPlotDimensions', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	const plotDim = viewModel.setPlotDimensions()
	test.deepEqual(plotDim.svg, { height: 590, width: 540 }, 'Should properly set svg')
	test.deepEqual(plotDim.xAxisLabel, { x: 280, y: 510 }, 'Should properly set xAxisLabel')
	// test.deepEqual(plotDim.xScale, { x: 90, y: 450, scale: scaleLinear()}, 'Should properly set xScale')
	test.deepEqual(
		plotDim.yAxisLabel,
		{ text: '-log10(adjusted P value)', x: 23.333333333333332, y: 240 },
		'Should properly set yAxisLabel'
	)
	// test.deepEqual(plotDim.yScale, { x: 70, y: 30, scale: scaleLinear() }, 'Should properly set yScale')
	test.deepEqual(plotDim.plot, { height: 400, width: 400, x: 90, y: 40 }, 'Should properly set plot')
	test.deepEqual(
		plotDim.logFoldChangeLine,
		{ x: 158.5301591547412, y1: 40, y2: 440 },
		'Should properly set logFoldChangeLine'
	)

	test.end()
})

tape('setPointData', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	const plotDim = viewModel.setPlotDimensions()
	const pointData = viewModel.setPointData(plotDim, 'red', 'blue')

	test.equal(pointData.length, 10, 'Should properly set pointData length')
	test.equal(
		pointData.filter((d: any) => d.color === 'black').length,
		9,
		'Should properly set color for each data point'
	)
	test.equal(
		pointData.filter((d: any) => d.highlighted === false).length,
		10,
		'Should properly set highlighted property for each data point'
	)
	test.equal(pointData.filter((d: any) => d.radius === 5).length, 10, 'Should properly set radius for each data point')

	test.end()
})

tape('setStatsData', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	const statsData = viewModel.setStatsData()
	const expected = [
		{ label: 'Percentage of significant genes', value: 10 },
		{ label: 'Number of significant genes', value: 1 },
		{ label: 'Number of total genes', value: 10 },
		{ label: 'Sensitive sample size (control group)', value: 3 },
		{ label: 'Resistant sample size (case group)', value: 3 }
	]
	test.deepEqual(statsData, expected, 'Should properly set statsData')

	test.end()
})

tape('setUserActions', function (test) {
	test.timeoutAfter(100)

	let result, expected

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	result = viewModel.setUserActions()
	expected = { noShow: new Set() }
	test.deepEqual(result, expected, `Should properly set user actions when method is ${viewModel.settings.method}`)

	viewModel.settings.method = 'wilcoxon'
	result = viewModel.setUserActions()
	expected = { noShow: new Set(['Confounding factors']) }
	test.deepEqual(result, expected, `Should properly set user actions when method is ${viewModel.settings.method}`)

	test.end()
})
