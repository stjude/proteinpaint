import test from 'tape'
import ViewModel from '../ViewModel'
import discoDefaults from '../../defaults'

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

// ───── Test 1: Constructor and field assignments ─────

test('ViewModel initializes with expected values', t => {
	const viewModel = new ViewModel(settings, mockRings, mockLegend, mockFusions, mockDataHolder, 'GeneSet123', 999)

	t.equal(viewModel.snvDataLength, 3, 'SNV data length is correct')
	t.equal(viewModel.filteredSnvDataLength, 1, 'Filtered SNV data length is correct')
	t.equal(viewModel.cnvMaxValue, 5, 'CNV gain max value is correct')
	t.equal(viewModel.cnvMinValue, -3, 'CNV loss max value is correct')
	t.equal(viewModel.positivePercentile80, 2, 'Percentile positive is correct')
	t.equal(viewModel.genesetName, 'GeneSet123', 'Gene set name is stored')

	t.ok(viewModel.width > 0, 'Width is computed')
	t.ok(viewModel.height > 0, 'Height is computed')
	t.equal(viewModel.legendHeight, 90, 'Legend height = 3 rows × 30px each')

	t.end()
})
