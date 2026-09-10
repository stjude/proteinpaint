import tape from 'tape'
import * as testData from './testData'
import { VolcanoViewModel } from '../viewModel/VolcanoViewModel'

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

// The server returns `data: VolcanoData` — threshold-passing rows live at
// `data.dots`, alongside the pre-rendered PNG + extents + total row count.
// Under the legacy fixture (pValue=1.3, foldChangeCutoff=0, pValueType='adjusted')
// only C1orf159 passes, so `dots` mirrors the 1 interactive row the server
// would emit for the old 10-row fixture; totalRows=10 lets numNonSignificant=9
// fall out for the stats tests.
const significantRow = testData.responseData.find((d: any) => d.gene_name === 'C1orf159')
// Server now echoes pixel_x/pixel_y per dot (manhattan trick) so the SVG
// overlay lands exactly on the rasterized PNG dot.
const significantWithPixels = significantRow ? { ...significantRow, pixel_x: 350, pixel_y: 100 } : null
const mockResponse = {
	data: {
		dots: significantWithPixels ? [significantWithPixels] : [],
		volcanoPng: '',
		plotExtent: {
			xMin: -0.1281,
			xMax: 0.6196,
			yMin: -0.192065410979292,
			yMax: 2.677780705266081,
			xMinUnpadded: -0.122,
			xMaxUnpadded: 0.59,
			yMinUnpadded: 0,
			yMaxUnpadded: 2.55,
			dotRadiusPx: 2,
			pixelWidth: 404,
			pixelHeight: 404,
			plotLeft: 0,
			plotTop: 0,
			plotRight: 404,
			plotBottom: 404,
			minNonZeroPValue: 1e-9
		},
		totalRows: testData.responseData.length,
		totalSignificantRows: significantRow ? 1 : 0
	},
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
	// Plot rect grows by 2*dotRadiusPx (= 4 px here) on each axis to match the
	// server's PNG padding, so all dependent positions shift by 4.
	test.deepEqual(plotDim.svg, { height: 594, width: 544 }, 'Should properly set svg')
	test.deepEqual(plotDim.xAxisLabel, { x: 282, y: 514 }, 'Should properly set xAxisLabel')
	test.deepEqual(
		plotDim.yAxisLabel,
		{ text: '-log10(adjusted P value)', x: 23.333333333333332, y: 242 },
		'Should properly set yAxisLabel'
	)
	test.deepEqual(plotDim.plot, { height: 404, width: 404, x: 90, y: 40 }, 'Should properly set plot')
	test.deepEqual(
		plotDim.logFoldChangeLine,
		{ x: 159.2154607462886, y1: 40, y2: 444 },
		'Should properly set logFoldChangeLine'
	)

	test.end()
})

tape('setPointData', function (test) {
	test.timeoutAfter(100)

	const viewModel = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)

	const plotDim = viewModel.setPlotDimensions()
	const pointData = viewModel.setPointData(plotDim, 'red', 'blue')

	// Only significant rows are in response.data; non-significant dots live in the PNG.
	test.equal(pointData.length, 1, 'Should properly set pointData length')
	test.equal(
		pointData.filter((d: any) => d.color === 'black').length,
		0,
		'All overlay circles are significant, so none should be colored as non-significant (black)'
	)
	test.equal(
		pointData.filter((d: any) => d.highlighted === false).length,
		1,
		'Should properly set highlighted property for each data point'
	)
	test.equal(pointData.filter((d: any) => d.radius === 2).length, 1, 'Should properly set radius for each data point')

	// mockSettings has showPValueTable: false. The rows must be collected anyway — "Download p value
	// table" reads them, and gating them on the display toggle shipped a header-only tsv.
	test.equal(
		viewModel.pValueTable.rows.length,
		1,
		'Should collect p value table rows even when the table is not displayed'
	)

	test.end()
})

tape('setPointData: rowKeys map rows to the dot identity', function (test) {
	test.timeoutAfter(100)

	// Gene expression: the Gene Name cell already IS the identity.
	const geVm = new VolcanoViewModel(mockConfig as any, mockResponse, mockSettings as any)
	geVm.setPointData(geVm.setPlotDimensions(), 'red', 'blue')
	const geRow = geVm.pValueTable.rows[0]
	test.equal(geVm.pValueTable.rowKeys.get(geRow), 'C1orf159', 'gene expression row should key on gene_name')

	/* DNA methylation: the Promoter cell shows a formatted label, so the identity is
	only recoverable through rowKeys. This is the regression -- hover/click highlighting
	compared the label against promoter_id and never matched a dot. */
	const dmDot = {
		promoter_id: 'NKAP.p4_chrX:119943104-119945251',
		gene_name: 'NKAP',
		chr: 'chrX',
		start: 119943104,
		stop: 119945251,
		fold_change: 0.6196,
		original_p_value: 0.0001,
		adjusted_p_value: 0.001,
		pixel_x: 350,
		pixel_y: 100
	}
	const dmVm = new VolcanoViewModel(
		{ ...mockConfig, termType: 'dnaMethylation' } as any,
		{ ...mockResponse, data: { ...mockResponse.data, dots: [dmDot] as any } },
		mockSettings as any
	)
	dmVm.setPointData(dmVm.setPlotDimensions(), 'red', 'blue')
	const dmRow = dmVm.pValueTable.rows[0]

	test.equal(dmRow[0].value, 'p4 · chrX:119943104-119945251', 'Promoter cell should show the formatted label')
	test.equal(
		dmVm.pValueTable.rowKeys.get(dmRow),
		'NKAP.p4_chrX:119943104-119945251',
		'methylation row should key on the raw promoter_id, not the displayed label'
	)
	test.notEqual(dmRow[0].value, dmVm.pValueTable.rowKeys.get(dmRow), 'label and identity must be distinct here')

	test.end()
})

/* The methylation table builds its columns in setPTableColumns and its cells in setPointData,
in two separate splices that must agree on ordinal position. Nothing enforces that structurally,
and getting it wrong renders Δβ under the "Mean β" header — wrong but entirely plausible on
screen. So assert the pairing by looking each value up through its own column label rather than
by a hardcoded index, which is also what the sort and download helpers do. */
/* The provenance line is what lets a downloaded table be traced back to the run that made it, so
its value is entirely in completeness: a setting that silently stops appearing turns two files
that differ for a real reason into two files that look identically configured. Assert each field
is present rather than matching the whole string, so wording can change but a dropped field
fails. */
tape('setProvenance records groups, sizes and every result-affecting setting', function (test) {
	test.timeoutAfter(100)

	const settings = {
		...mockSettings,
		minSamplesPerGroup: 3,
		excludeSexChr: false,
		xAxis: 'delta_beta',
		deltaBetaCutoff: 0.1
	}
	const vm = new VolcanoViewModel({ ...mockConfig, termType: 'dnaMethylation' } as any, mockResponse, settings as any)
	const p = vm.viewData.provenance

	test.ok(p.includes('Sensitive') && p.includes('Resistant'), 'names both groups')
	test.ok(p.includes('n=3'), 'records the sample size the model actually used')
	test.ok(/group1 \(control\)/.test(p) && /group2 \(case\)/.test(p), 'labels which arm is control vs case')
	test.ok(p.includes('confounders: none'), 'states confounders explicitly rather than omitting them when absent')
	/* The setting that changes WHAT was tested rather than how. Without it an exported
	p-value table cannot be attributed to an element matrix after the fact, and two runs on
	different matrices look interchangeable. Defaults to 'promoter' so a legacy
	single-matrix run is still labelled rather than blank. */
	test.ok(p.includes('element class: promoter'), 'records elementType, defaulting when unset')
	/* Differential methylation always plots and thresholds on delta-beta, so the provenance must
	say so in both places — the axis and the cutoff. A bare "0.1" is ambiguous, since it is a
	plausible value in either unit. */
	test.ok(p.includes('x axis: delta-beta'), 'records that DM plots delta-beta')
	test.ok(p.includes('|delta-beta| > 0.1'), 'names the effect-size measure the cutoff applies to')
	test.ok(p.includes('min samples per group: 3'), 'records minSamplesPerGroup')
	test.ok(p.includes('exclude sex chromosomes: no'), 'records excludeSexChr')
	// pValue is stored as -log10, so the line must show the p a reader would recognise
	test.ok(p.includes('adjusted p < 0.05'), 'converts the -log10 threshold back to a readable p-value')

	test.end()
})

/* "case" and "control" are slot names, not group names, so the old axis label said how big an
effect was but not which direction it pointed. Naming the groups is the only place on the plot
that states the direction -- the provenance line does too, but only inside a downloaded file. */
tape('deltaBetaAxisLabel names the groups in subtraction order', function (test) {
	test.timeoutAfter(100)

	const dmConfig = { ...mockConfig, termType: 'dnaMethylation' } as any
	const vm = new VolcanoViewModel(dmConfig, mockResponse, mockSettings as any)
	const label = vm.viewData.deltaBetaAxisLabel

	// groups[0] is the control and groups[1] the case, and delta_beta is case - control,
	// so the case name must come first for the label to describe the actual subtraction
	test.equal(label, 'Δβ (Resistant − Sensitive)', 'reads case − control using the real group names')

	{
		// a long name must be shortened the same way the group labels above the plot are,
		// or it overflows the centered axis label
		const longName = 'Not in a group with a very long user supplied name'
		const cfg = {
			...dmConfig,
			samplelst: { groups: [{ ...testData.groups[0], name: longName }, testData.groups[1]] }
		}
		const shortened = new VolcanoViewModel(cfg, mockResponse, mockSettings as any).viewData.deltaBetaAxisLabel!
		test.ok(shortened.includes('...'), 'shortens an over-long group name')
		test.ok(!shortened.includes(longName), 'does not emit the full over-long name')
	}

	{
		/* Falls back rather than rendering "Δβ (undefined − undefined)". Called directly rather
		than through the constructor: single-cell DE has no config.samplelst at all, but a
		constructor call cannot reach that state here because setTermInfo() runs first and
		hard-requires groups[0]/[1] for the term types that do use samplelst. */
		const noGroups = (VolcanoViewModel.prototype as any).setDeltaBetaAxisLabel.call({ config: {} })
		test.equal(noGroups, undefined, 'undefined when the config carries no sample groups')
	}

	test.end()
})

tape('setPointData: methylation cells line up with their column headers', function (test) {
	test.timeoutAfter(100)

	const dmDot = {
		promoter_id: 'NKAP.p4_chrX:119943104-119945251',
		gene_name: 'NKAP',
		chr: 'chrX',
		start: 119943104,
		stop: 119945251,
		fold_change: 0.6196,
		mean_beta_control: 0.42,
		mean_beta_case: 0.61,
		delta_beta: 0.19,
		original_p_value: 0.0001,
		adjusted_p_value: 0.001,
		pixel_x: 350,
		pixel_y: 100
	}
	const vm = new VolcanoViewModel(
		{ ...mockConfig, termType: 'dnaMethylation' } as any,
		{ ...mockResponse, data: { ...mockResponse.data, dots: [dmDot] as any } },
		mockSettings as any
	)
	vm.setPointData(vm.setPlotDimensions(), 'red', 'blue')
	const row = vm.pValueTable.rows[0]
	const cols = vm.pValueTable.columns

	test.equal(cols.length, row.length, 'one cell per column')
	const cellFor = (label: string) => row[cols.findIndex(c => c.label == label)]?.value

	test.equal(cellFor('Δβ'), 0.19, 'Δβ cell sits under the Δβ header')
	test.equal(cellFor('Mean β (group 1)'), 0.42, 'group 1 mean beta is the control mean')
	test.equal(cellFor('Mean β (group 2)'), 0.61, 'group 2 mean beta is the case mean')
	// 0.62, not 0.6196: table cells are passed through roundValueAuto for display
	test.equal(cellFor('log₂(fold-change)'), 0.62, 'fold-change stayed put when the beta columns were inserted')
	test.equal(cellFor('Adjusted p-value'), 0.001, 'the p-value columns shifted right rather than being overwritten')

	// Δβ is the interpretable effect size and must sit beside the fold-change, not off in the tail
	test.equal(
		cols.findIndex(c => c.label == 'Δβ') - cols.findIndex(c => c.label == 'log₂(fold-change)'),
		1,
		'Δβ is immediately after log₂(fold-change)'
	)

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
