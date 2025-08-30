import tape from 'tape'
import * as d3s from 'd3-selection'
import { ViewModel } from '../viewModel/ViewModel'
import type { CorrVolcanoSettings } from '../CorrelationVolcanoTypes'
import type { GeneExpressionTW } from '#types'

/**
 * Tests
 *   - Default ViewModel
 */

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

const mockData = {
	skippedVariables: [],
	variableItems: [
		{
			tw$id: 'test$id2',
			sampleSize: 726,
			correlation: 0.07,
			original_pvalue: 0.0593,
			adjusted_pvalue: 0.431
		},
		{
			tw$id: 'test$id3',
			sampleSize: 373,
			correlation: -0.0088,
			original_pvalue: 0.8657,
			adjusted_pvalue: 0.8657
		}
	]
}

const mockSettings = {
	antiCorrColor: '#ff0000',
	corrColor: '#0000ff',
	isAdjustedPValue: false,
	method: 'pearson',
	threshold: 0.05,
	height: 500,
	width: 500,
	radiusMax: 20,
	radiusMin: 5
} satisfies CorrVolcanoSettings

const mockVariableTwLst = [
	{
		$id: 'test$id2',
		id: 'Asparaginase_normalizedLC50',
		term: {
			name: 'Asparaginase LC50 (normalized)'
		},
		type: 'NumTWRegularBin'
	},
	{
		$id: 'test$id3',
		id: 'Bortezomib_normalizedLC50',
		term: {
			name: 'Bortezomib LC50 (normalized)'
		},
		type: 'NumTWRegularBin'
	}
]

const mockConfig = {
	id: '1',
	chartType: 'correlationVolcano',
	featureTw: {
		type: 'NumTWCont',
		$id: 'test$id',
		term: {
			id: 'testid',
			type: 'geneExpression',
			gene: 'KRAS',
			name: 'KRAS'
		},
		q: {}
	} satisfies GeneExpressionTW,
	settings: {
		correlationVolcano: mockSettings
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/correlationVolcano -***-')
	test.end()
})

tape('Default ViewModel', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any
	const dom = {
		plot: holder.append('svg').append('g')
	}

	const viewModel = new ViewModel(mockConfig, mockData, dom as any, mockSettings, mockVariableTwLst as any)
	test.equal(viewModel.bottomPad, 60, `Should set bottom padding to 60`)
	test.equal(viewModel.horizPad, 70, `Should set horizontal padding to 70`)
	test.equal(viewModel.topPad, 40, `Should set top padding to 40`)

	const expectedViewData = {
		plotDim: {
			svg: { height: 660, width: 640 },
			title: { text: 'KRAS Gene Expression', x: 320, y: 20 },
			xAxisLabel: { x: 320, y: 600 },
			yAxisLabel: { x: 23.333333333333332, y: 290 },
			xScale: { x: 70, y: 540 },
			yScale: { x: 70, y: 40 },
			divideLine: { x: 320, y1: 540, y2: 40 },
			thresholdLine: { y: 55.15435619536254, x1: 70, x2: 570 }
		},
		variableItems: [
			{
				tw$id: 'test$id2',
				sampleSize: 726,
				correlation: 0.07,
				original_pvalue: 0.0593,
				adjusted_pvalue: 0.431,
				transformed_original_pvalue: 1.2269453066357374,
				color: '#0000ff',
				label: 'Asparaginase LC50 (normalized)',
				x: 547.2727272727273,
				y: 81.66666666666669,
				radius: 20,
				previousX: 547.2727272727273,
				previousY: 81.66666666666669
			},
			{
				tw$id: 'test$id3',
				sampleSize: 373,
				correlation: -0.0088,
				original_pvalue: 0.8657,
				adjusted_pvalue: 0.8657,
				transformed_original_pvalue: 0.06263258248271039,
				color: '#ff0000',
				label: 'Bortezomib LC50 (normalized)',
				x: 291.42857142857144,
				y: 498.3333333333333,
				radius: 5,
				previousX: 291.42857142857144,
				previousY: 498.3333333333333
			}
		],
		legendData: {
			absMin: 373,
			absMax: 726,
			skippedVariables: []
		}
	}

	test.deepEqual(
		viewModel.viewData.plotDim.svg,
		expectedViewData.plotDim.svg,
		`Should set the svg dimensions as expected`
	)
	test.deepEqual(viewModel.viewData.plotDim.title, expectedViewData.plotDim.title, `Should set the title as expected`)
	test.deepEqual(
		viewModel.viewData.plotDim.xAxisLabel,
		expectedViewData.plotDim.xAxisLabel,
		`Should set the x-axis label as expected`
	)
	test.deepEqual(
		viewModel.viewData.plotDim.yAxisLabel,
		expectedViewData.plotDim.yAxisLabel,
		`Should set the y-axis label as expected`
	)
	test.deepEqual(
		viewModel.viewData.plotDim.divideLine,
		expectedViewData.plotDim.divideLine,
		`Should set the divide line as expected`
	)
	test.deepEqual(
		viewModel.viewData.plotDim.thresholdLine,
		expectedViewData.plotDim.thresholdLine,
		`Should set the threshold line as expected`
	)
	test.deepEqual(
		viewModel.viewData.variableItems,
		expectedViewData.variableItems,
		`Should set the variable items as expected`
	)
	test.deepEqual(viewModel.viewData.legendData, expectedViewData.legendData, `Should set the legend data as expected`)

	if (test['_ok']) holder.remove()
	test.end()
})
