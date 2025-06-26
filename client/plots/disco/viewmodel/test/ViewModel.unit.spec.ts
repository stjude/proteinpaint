import test from 'tape'
import ViewModel from '../ViewModel'
import discoDefaults from '../../defaults'

/*
Tests:
	ViewModel initializes with expected values
*/

// ───── Mock Data Setup ─────

// Use discoDefaults to avoid manually writing every settings field
const settings = discoDefaults({
	rings: {
		labelLinesInnerRadius: 100,
		labelsToLinesDistance: 20
	},
	legend: {
		rowHeight: 30
	}
})

// Mock ring structure, each with empty elements to test getElements
const mockRings = {
	chromosomesRing: { elements: [] },
	labelsRing: { elementsToDisplay: [], collisions: [] },
	nonExonicArcRing: { elements: [] },
	snvArcRing: { elements: [] },
	cnvArcRing: { elements: [] },
	lohArcRing: { elements: [] }
} as any

// Mock Legend with 3 rows to verify legendHeight = rowHeight × count
const mockLegend = {
	legendCount: () => 3
} as any

// Empty list of Fusion ribbons
const mockFusions = []

// Mock DataHolder with sample SNV/CNV stats
const mockDataHolder = {
	snvData: [{}, {}, {}], // 3 SNV entries
	filteredSnvData: [{}], // 1 filtered SNV entry
	snvRingDataMap: new Map(), // unused in this test
	cnvGainMaxValue: 5,
	cnvLossMaxValue: -3,
	cappedCnvMaxAbsValue: 4,
	percentileNegative: -2,
	percentilePositive: 2
} as any

test('\n', function (t) {
	t.pass('-***- plots/disco/viewmodel/ViewModel -***-')
	t.end()
})

// ───── Test 1: Constructor and field assignments ─────

test('ViewModel initializes with expected values', t => {
	const viewModel = new ViewModel(settings, mockRings, mockLegend, mockFusions, mockDataHolder, 'GeneSet123', 999)

	t.equal(
		viewModel.snvDataLength,
		mockDataHolder.snvData.length,
		`SNV data length should return ${mockDataHolder.snvData.length}`
	)
	t.equal(
		viewModel.filteredSnvDataLength,
		mockDataHolder.filteredSnvData.length,
		`Filtered SNV data length should return ${mockDataHolder.filteredSnvData.length}`
	)
	t.equal(
		viewModel.cnvMaxValue,
		mockDataHolder.cnvGainMaxValue,
		`CNV max gain value should return ${mockDataHolder.cnvGainMaxValue}`
	)
	t.equal(
		viewModel.cnvMinValue,
		mockDataHolder.cnvLossMaxValue,
		`CNV min loss value should return ${mockDataHolder.cnvLossMaxValue}`
	)
	t.equal(
		viewModel.positivePercentile,
		mockDataHolder.percentilePositive,
		`Percentile positive should return ${mockDataHolder.percentilePositive}`
	)
	t.equal(viewModel.genesetName, 'GeneSet123', 'Gene set name is stored')

	t.ok(viewModel.width > 0, 'Width is computed and greater than 0')
	t.ok(viewModel.height > 0, 'Height is computed and greater than 0')
	t.equal(
		viewModel.legendHeight,
		mockLegend.legendCount() * settings.legend.rowHeight,
		`Legend height should return ${mockLegend.legendCount()} rows × ${settings.legend.rowHeight}px = ${
			mockLegend.legendCount() * settings.legend.rowHeight
		}`
	)

	t.end()
})
