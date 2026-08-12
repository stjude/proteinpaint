import tape from 'tape'
import { AggMatrixViewModel } from '../viewModel/AggMatrixViewModel'

/*
Tests:
    - Default ViewModel constructor

See unit tests for #dom/boxplot for rendering unit tests
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
    test.equal(dotPosition.size, 8, 'Should carry over dot size')
    test.equal(dotPosition.row, 'TP53', 'Should carry over row id')
    test.equal(dotPosition.column, 'B cell', 'Should carry over column id')
    test.equal(dotPosition.tipData.length, 4, 'Should provide standard tooltip entries')

    test.end()
})