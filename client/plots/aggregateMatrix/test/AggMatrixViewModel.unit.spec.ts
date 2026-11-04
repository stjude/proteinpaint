import tape from 'tape'
import { AggMatrixViewModel } from '../viewModel/AggMatrixViewModel'

/*
Tests:
    - Default ViewModel constructor
    - Default view data structure
    - setColorScale and getDotPositions
    - Tooltip values
    - Pies in the dot positions
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

tape('Pies in the dot positions', function (test) {
	const { viewModel, mockAggregateMatrix } = getViewModel()
	const settings = mockAggregateMatrix.state.config.settings.aggregateMatrix
	viewModel.viewData = viewModel.getDefaultViewData()
	viewModel.setColorScale(settings, { min: 0, max: 10 })
	viewModel.sizeScale = (v: number) => v

	const pie = {
		n: 100,
		radius: 1,
		termType: 'geneVariant',
		slices: [
			{ key: 'WT', label: 'Wildtype', color: '#D3D3D3', count: 99, hidden: true },
			{ key: 'M', label: 'MISSENSE', color: '#3987CC', count: 1 }
		]
	}
	const hiddenOnly = {
		n: 5,
		radius: 1,
		slices: [{ key: 'WT', label: 'Wildtype', color: '#ccc', count: 5, hidden: true }]
	}
	const dot = (column: string, withPie?: any) => ({
		row: 'TP53',
		rowSection: 'Genes',
		column,
		colSection: 'Cell type',
		colorValue: 1,
		sizeValue: 1,
		...(withPie && { pie: withPie })
	})
	viewModel.getDotPositions([[dot('B', pie), dot('Hidden', hiddenOnly), dot('None')]], 10, settings, {
		name: 'cell',
		plural_name: 'cells'
	})
	const [shown, hidden, none] = viewModel.viewData.dotPositions

	test.equal(shown.pie?.radius, settings.maxDotSize, 'Should add the pie to the dot')
	test.equal(shown.hasData, true, 'Should treat a dot with a pie as data')
	test.deepEqual(
		shown.tipData.slice(4).map(e => [e.label, e.value]),
		[
			['Cells', 1],
			['MISSENSE', 1]
		],
		'Should add the drawn slices of the pie to the tooltip after the standard entries'
	)
	for (const [name, position] of [
		['a pie whose slices are all hidden', hidden],
		['a dot without a pie in a pie chart', none]
	] as const) {
		test.equal(position.pie, undefined, `Should not draw ${name}`)
		test.equal(position.hasData, false, `Should treat ${name} as no data`)
		test.equal(position.color, 'transparent', `Should leave ${name} blank`)
		test.equal(position.tipData.length, 4, `Should only add the standard tooltip entries for ${name}`)
		test.equal(position.tipData[3].value, 'No available data', `Should report that no data is available for ${name}`)
	}

	viewModel.viewData.dotPositions = []
	viewModel.getDotPositions([[dot('A'), dot('B')]], 10, settings, undefined)
	test.ok(
		viewModel.viewData.dotPositions.every(d => d.hasData && !d.pie),
		'Should keep drawing circles for dots with data when there are no pies'
	)
	test.end()
})

tape('Pies without a color scale', function (test) {
	const { viewModel, mockAggregateMatrix } = getViewModel()
	const settings = mockAggregateMatrix.state.config.settings.aggregateMatrix
	viewModel.viewData = viewModel.getDefaultViewData()
	viewModel.viewData.hasColorScale = false
	viewModel.sizeScale = (v: number) => v
	const pie = {
		n: 10,
		radius: 1,
		termType: 'geneVariant',
		slices: [{ key: 'M', label: 'MISSENSE', color: '#3987CC', count: 4 }]
	}
	const dot = (column: string, withPie?: any): any => ({
		row: 'TP53',
		rowSection: 'Genes',
		column,
		colSection: 'Sex',
		colorValue: null,
		sizeValue: 3,
		...(withPie && { pie: withPie })
	})
	viewModel.getDotPositions([[dot('F', pie), dot('M')]], 10, settings)
	const [shown, none] = viewModel.viewData.dotPositions
	test.equal(shown.hasData, true, 'Should treat a pie as data without a color value')
	test.ok(shown.pie, 'Should draw the pie')
	const labels = shown.tipData.map(e => e.label)
	test.notOk(labels.includes('Mean'), 'Should not show the color value in the tooltip of a pie')
	test.ok(labels.includes('Percent'), 'Should still show the size value')
	test.equal(none.hasData, false, 'Should treat a dot without a pie as no data')
	test.end()
})
