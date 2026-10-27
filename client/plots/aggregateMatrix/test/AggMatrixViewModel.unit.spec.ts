import tape from 'tape'
import { AggMatrixViewModel } from '../viewModel/AggMatrixViewModel'
import { mclass } from '#shared/common.js'

/*
Tests:
    - Default ViewModel constructor
    - Default view data structure
    - setColorScale and getDotPositions
    - Tooltip values
    - Pie positions, tooltip, and legend
*/

function getViewModel() {
	const mockAggregateMatrix: any = {
		state: {
			config: {
				settings: {
					aggregateMatrix: {
						startColor: '#00ff00',
						stopColor: '#ff0000',
						gradientMethod: 'mean',
						sizeMethod: 'percent',
						minDotSize: 2,
						maxDotSize: 24,
						dotInputMin: 0,
						dotInputMax: 100
					}
				}
			}
		}
	}

	return {
		viewModel: new AggMatrixViewModel(mockAggregateMatrix),
		mockAggregateMatrix
	}
}

tape('\n', function (test) {
	test.comment('-***- plots/aggregateMatrix/viewModel/AggMatrixViewModel -***-')
	test.end()
})

tape('Default ViewModel constructor', function (test) {
	test.timeoutAfter(100)

	const { viewModel, mockAggregateMatrix } = getViewModel()

	test.equal(viewModel.ag, mockAggregateMatrix, 'Should store the aggregate matrix instance')
	test.equal(viewModel.topPad, 20, 'Should set default top padding')
	test.equal(viewModel.hoziPad, 20, 'Should set default horizontal padding')
	test.equal(viewModel.bottomPad, 20, 'Should set default bottom padding')
	test.equal(viewModel.labelFontPx, 12, 'Should set default label font size')
	test.true(Array.isArray(viewModel.rowSectionRotateFlags), 'Should initialize row section rotate flags')
	test.true(Array.isArray(viewModel.colSectionRotateFlags), 'Should initialize col section rotate flags')
	test.equal(viewModel.rowSectionRotateFlags.length, 0, 'Should start with no row section rotate flags')
	test.equal(viewModel.colSectionRotateFlags.length, 0, 'Should start with no col section rotate flags')

	test.end()
})

tape('Default view data structure', function (test) {
	test.timeoutAfter(100)

	const { viewModel } = getViewModel()
	const defaultViewData = viewModel.getDefaultViewData()

	test.equal(defaultViewData.plotDim.svg.width, 0, 'Should initialize default svg width to 0')
	test.equal(defaultViewData.plotDim.svg.height, 0, 'Should initialize default svg height to 0')
	test.equal(defaultViewData.plotDim.rowLabels.x, 0, 'Should initialize default row label x to 0')
	test.equal(defaultViewData.plotDim.colLabels.y, 0, 'Should initialize default column label y to 0')
	test.equal(defaultViewData.rowLabels.length, 0, 'Should initialize with no row labels')
	test.equal(defaultViewData.colLabels.length, 0, 'Should initialize with no column labels')
	test.equal(defaultViewData.dotPositions.length, 0, 'Should initialize with no dot positions')
	test.equal(defaultViewData.colorScale.absMin, 0, 'Should initialize default absolute min color value to 0')
	test.equal(defaultViewData.colorScale.absMax, 0, 'Should initialize default absolute max color value to 0')
	test.equal(defaultViewData.colorScale.scale(1), '', 'Should initialize default color scale function')

	test.end()
})

tape('setColorScale and getDotPositions', function (test) {
	test.timeoutAfter(100)

	const { viewModel, mockAggregateMatrix } = getViewModel()
	viewModel.viewData = viewModel.getDefaultViewData()

	viewModel.setColorScale(mockAggregateMatrix.state.config.settings.aggregateMatrix, { min: 0, max: 100 })
	test.equal(viewModel.viewData.colorScale.absMin, 0, 'Should set absolute minimum color value')
	test.equal(viewModel.viewData.colorScale.absMax, 100, 'Should set absolute maximum color value')

	const minColor = viewModel.viewData.colorScale.scale(0)
	const maxColor = viewModel.viewData.colorScale.scale(100)
	test.equal(typeof minColor, 'string', 'Should produce a string color value at min scale')
	test.equal(typeof maxColor, 'string', 'Should produce a string color value at max scale')
	test.notEqual(minColor, maxColor, 'Should produce different colors at min and max values')

	viewModel.setColorScale(mockAggregateMatrix.state.config.settings.aggregateMatrix, { min: 0, max: 0 })
	test.equal(viewModel.viewData.colorScale.absMin, 0, 'Should preserve constant color value as absolute minimum')
	test.equal(viewModel.viewData.colorScale.absMax, 0, 'Should preserve constant color value as absolute maximum')
	test.equal(
		viewModel.viewData.colorScale.scale(0),
		'rgb(128, 128, 0)', //#808000
		'Should map a constant color value to the midpoint of the color range'
	)

	viewModel.maxRowLabelLgth = 30
	const cellSize = 10
	viewModel.getDotPositions(
		[
			[
				{
					row: 'TP53',
					rowSection: 'Genes',
					column: 'B cell',
					colSection: 'Cell type',
					colorValue: 25,
					sizeValue: 0.72
				}
			]
		],
		cellSize,
		mockAggregateMatrix.state.config.settings.aggregateMatrix
	)

	test.equal(viewModel.viewData.dotPositions.length, 1, 'Should create one dot position for one input dot')
	const dotPosition = viewModel.viewData.dotPositions[0]
	test.equal(dotPosition.x, 55, 'Should compute x position from horizontal padding, labels, and cell size')
	test.equal(dotPosition.y, 25, 'Should compute y position from top padding and cell size')
	test.equal(dotPosition.size, 0.72, 'Should compute size from input size value')
	test.equal(dotPosition.row, 'TP53', 'Should carry over row id')
	test.equal(dotPosition.column, 'B cell', 'Should carry over column id')
	test.equal(dotPosition.tipData.length, 4, 'Should provide standard tooltip entries')

	test.end()
})

tape('Tooltip values', function (test) {
	const { viewModel, mockAggregateMatrix } = getViewModel()
	const settings = mockAggregateMatrix.state.config.settings.aggregateMatrix
	viewModel.viewData = viewModel.getDefaultViewData()
	viewModel.setColorScale(settings, { min: 0, max: 100 })
	viewModel.maxRowLabelLgth = 30
	const getTip = (colorValue: number | null, sizeValue: number | null, overrides = {}) => {
		viewModel.viewData.dotPositions = []
		viewModel.getDotPositions(
			[[{ row: 'TP53', rowSection: 'Genes', column: 'Male', colSection: 'Sex', colorValue, sizeValue }]],
			10,
			{ ...settings, ...overrides }
		)
		return Object.fromEntries(viewModel.viewData.dotPositions[0].tipData.map(entry => [entry.label, entry.value]))
	}

	const methods = { gradientMethod: 'percent', sizeMethod: 'count' }
	let tip = getTip(35.714285714285715, 25, methods)
	test.equal(tip.Percent, 35.71, 'Should round percent to two decimals')
	test.equal(tip.Count, 25, 'Should leave a whole count as is')
	test.equal(getTip(50, 3, methods).Percent, 50, 'Should leave a whole percent as is')
	test.equal(getTip(0.909090909, 1, methods).Percent, 0.91, 'Should round a percent under 1 to two digits')
	test.equal(
		getTip(40, 2.7272727, { gradientMethod: 'count', sizeMethod: 'percent' }).Percent,
		2.73,
		'Should round the value of the size method too'
	)

	const mean = { gradientMethod: 'mean', sizeMethod: 'count' }
	test.equal(getTip(12.3456, 4, mean).Mean, 12.35, 'Should round mean to two decimals')
	test.equal(getTip(0.5069, 4, mean).Mean, 0.51, 'Should round a mean under 1 to two digits')
	test.equal(getTip(0.4941, 4, mean).Mean, 0.49, 'Should round a mean under 1 down')
	test.equal(getTip(0.004, 4, mean).Mean, 0.004, 'Should not round a tiny mean to zero')
	test.equal(getTip(25, 4, mean).Mean, 25, 'Should leave a whole number mean as is')
	test.equal(getTip(0, 4, mean).Mean, 0, 'Should leave a mean of zero as zero')

	tip = getTip(null, null, methods)
	test.equal(tip.Percent, 'No available data', 'Should state when the gradient value has no data, not show zero')
	test.equal(tip.Count, 'No available data', 'Should state when the size value has no data, not show zero')
	test.end()
})

tape('Pie positions, tooltip, and legend', function (test) {
	const { viewModel, mockAggregateMatrix } = getViewModel()
	const settings = mockAggregateMatrix.state.config.settings.aggregateMatrix
	viewModel.viewData = viewModel.getDefaultViewData()
	viewModel.setColorScale(settings, { min: 0, max: 10 })
	viewModel.sizeScale = (v: number) => v

	const pie = (n: number, radius: number, termType?: string) => ({
		n,
		radius,
		termType,
		slices: [
			{ key: 'WT', label: 'Wildtype', color: '#D3D3D3', count: n - 1 },
			{ key: 'M', label: 'MISSENSE', color: '#3987CC', count: 1 }
		]
	})
	const dot = (column: string, withPie?: any) => ({
		row: 'TP53',
		rowSection: 'Genes',
		column,
		colSection: 'Cell type',
		colorValue: 1,
		sizeValue: 1,
		...(withPie && { pie: withPie })
	})
	const data = [
		[
			dot('B', pie(100, 1, 'geneVariant')),
			dot('T', pie(25, 0.5, 'geneVariant')),
			dot('Tiny', pie(1, 0.001)),
			dot('None')
		]
	]
	viewModel.getDotPositions(data, 10, settings, { name: 'cell', plural_name: 'cells' })
	const [big, half, tiny, none] = viewModel.viewData.dotPositions

	test.equal(big.pie?.radius, settings.maxDotSize, 'Should draw the largest pie at the maximum dot size')
	test.equal(half.pie?.radius, settings.maxDotSize * 0.5, 'Should keep the pie area proportional to n')
	test.equal(tiny.pie?.radius, settings.minDotSize, 'Should not draw a pie smaller than the minimum dot size')
	test.equal(none.pie, undefined, 'Should leave a dot without a pie as a circle')
	test.equal(big.pie?.slices.length, 2, 'Should create a slice for every slice of the server')
	test.ok(
		big.pie?.slices.every(s => s.path.startsWith('M')),
		'Should create an svg path for every slice'
	)
	test.deepEqual(
		big.tipData.slice(4).map(e => [e.label, e.value]),
		[
			['Cells', 100],
			['Wildtype', 99],
			['MISSENSE', 1]
		],
		'Should add the number of samples and each slice to the tooltip'
	)
	test.equal(none.tipData.length, 4, 'Should not add pie entries to a dot without a pie')

	// the client mclass has the launch argument mclassOverride applied, so it decides the look of a variant class
	const original = { ...mclass.M }
	Object.assign(mclass.M, { label: 'Custom missense', color: '#123456' })
	const overridden = viewModel.getPiePosition(pie(10, 1, 'geneVariant'), settings)
	Object.assign(mclass.M, original)
	test.deepEqual(
		overridden.slices.find(s => s.key == 'M') && {
			label: overridden.slices.find(s => s.key == 'M')!.label,
			color: overridden.slices.find(s => s.key == 'M')!.color
		},
		{ label: 'Custom missense', color: '#123456' },
		'Should describe a variant class by the mclass of the client, which has the override'
	)
	const other = viewModel.getPiePosition(pie(10, 1, 'categorical'), settings)
	test.equal(
		other.slices.find(s => s.key == 'M')!.color,
		'#3987CC',
		'Should keep the server color for other term types'
	)

	const legend = viewModel.getPieLegend(data)
	test.equal(legend.title, 'Variant class', 'Should title a gene variant legend')
	test.deepEqual(
		legend.entries.map(e => e.key),
		['WT', 'M'],
		'Should list every slice once, in order of first appearance'
	)
	test.deepEqual(viewModel.getPieLegend([[dot('None')]]).entries, [], 'Should have no legend entries without pies')
	test.end()
})
