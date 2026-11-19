import tape from 'tape'
import { select } from 'd3-selection'
import { VolcanoViewModel } from '../viewModel/VolcanoViewModel'
import { VolcanoPlotView } from '../view/VolcanoPlotView'
import { roundValueAuto as r } from '#shared/roundValue.js'
import { formatPromoterLabel } from '../promoterLabel'
import * as testData from './testData'

/* Tests:
	- the p-value table, the hover table of several dots, and the tooltip of one dot, by data type:
	  gene expression, single-cell cell type, proteome, methylation on either axis, DMR scan, splicing
*/

const baseSettings = {
	defaultSignColor: 'red',
	defaultNonSignColor: 'black',
	defaultHighlightColor: '#ffa200',
	foldChangeCutoff: 0,
	height: 400,
	width: 400,
	method: 'edgeR',
	pValue: 1.3,
	pValueType: 'adjusted',
	showPValueTable: false
}

const config = {
	confounderTws: [],
	highlightedData: [] as string[],
	samplelst: { groups: testData.groups },
	tw: { q: { groups: testData.groups }, term: { name: 'groups', type: 'samplelst', values: {} } }
}

/** a response of these dots, all of them significant */
function getResponse(dots: any[], extra: any = {}) {
	return {
		data: {
			dots: dots.map((d, i) => ({ ...d, pixel_x: 10 + i, pixel_y: 10 + i })),
			volcanoPng: '',
			plotExtent: {
				xMin: -1,
				xMax: 1,
				yMin: 0,
				yMax: 3,
				xMinUnpadded: -1,
				xMaxUnpadded: 1,
				yMinUnpadded: 0,
				yMaxUnpadded: 3,
				dotRadiusPx: 2,
				pixelWidth: 404,
				pixelHeight: 404,
				plotLeft: 0,
				plotTop: 0,
				plotRight: 404,
				plotBottom: 404,
				minNonZeroPValue: 1e-9
			},
			totalRows: dots.length,
			totalSignificantRows: dots.length,
			totalSignificantUp: 0,
			totalSignificantDown: 0,
			xOffset: 0,
			centered: false
		},
		images: [],
		sample_size1: 3,
		sample_size2: 3,
		...extra
	} as any
}

const geDots = [
	{ gene_name: 'KRAS', fold_change: -0.5, original_p_value: 0.02 },
	{ gene_name: 'TP53', fold_change: 1.23456, original_p_value: 0.000123456, adjusted_p_value: 0.00234567 }
]
const dapDot = { gene_name: 'P04637', gene: 'TP53', fold_change: 0.8, original_p_value: 0.01, adjusted_p_value: 0.01 }
const dmDot = {
	promoter_id: 'NKAP.p4_chrX:100-200',
	gene_name: 'NKAP',
	chr: 'chrX',
	start: 100,
	stop: 200,
	fold_change: 0.62,
	delta_beta: 0.123,
	mean_beta_control: 0.4,
	mean_beta_case: 0.523,
	original_p_value: 0.0001,
	adjusted_p_value: 0.001
}
const scanDot = {
	promoter_id: 'chr1:1000-2000',
	gene_name: 'GENEA, GENEB',
	chr: 'chr1',
	start: 1000,
	stop: 2000,
	delta_beta: -0.21,
	fold_change: -0.35,
	original_p_value: 0.012,
	adjusted_p_value: 0.012,
	no_cpgs: 14,
	min_smoothed_fdr: 0.004
}
const scan = {
	chromosomes: ['chr1'],
	totalProbesAnalyzed: 1000,
	called: 3,
	minCpgs: 5,
	kept: 2,
	hyper: 1,
	hypo: 1,
	width: { median: 1000, q1: 800, q3: 1500 },
	yAxis: 'HMFDR'
}
const scanSettings = {
	elementType: 'dmr_scan',
	xAxis: 'delta_beta',
	deltaBetaCutoff: 0.1,
	minSamplesPerGroup: 3,
	excludeSexChr: false,
	scanChromosome: '',
	minCpgs: 5,
	scanYAxis: 'HMFDR'
}
const spliceDot = {
	cluster_id: 'clu_1',
	genes: 'GENEA,GENEB',
	chr: 'chr2',
	start: 10,
	stop: 90,
	delta_psi: 0.234,
	psi_control: 0.1,
	psi_case: 0.334,
	n_junc: 3,
	top_intron: 'chr2:20-40',
	original_p_value: 0.003,
	adjusted_p_value: 0.03
}

/** the three tables of one data type, rendered from these dots */
function getTables(termType: string, dots: any[], settings: any = {}, responseExtra: any = {}, highlight?: string) {
	const s = { ...baseSettings, ...settings }
	const vm = new VolcanoViewModel(
		{ ...config, termType, highlightedData: highlight ? [highlight] : [] } as any,
		getResponse(dots, responseExtra),
		s as any
	)
	const holder = select(document.body).append('div')
	const view: any = new VolcanoPlotView({ holder, actionsTip: { d: holder } } as any, {} as any, termType)
	view.settings = s
	view.viewData = vm.viewData
	const hit = view.buildMultiHitTable(vm.viewData.pointData)
	const tooltips = vm.viewData.pointData.map((d: any) => {
		const rows: [string, any][] = []
		const table = {
			addRow() {
				const row: [string, any] = ['', undefined]
				rows.push(row)
				return [{ html: (t: string) => (row[0] = t) }, { text: (v: any) => (row[1] = v) }]
			}
		}
		view.addTooltipRows(d, table)
		return rows
	})
	holder.remove()
	const table = vm.viewData.pValueTableData
	return {
		columns: table.columns.map((c: any) => [c.label, !!c.sortable, !!c.barplot]),
		rows: table.rows.map((row: any) => row.map((c: any) => c.value)),
		rowKeys: table.rows.map((row: any) => table.rowKeys.get(row)),
		highlighted: vm.viewData.pointData.filter((d: any) => d.highlighted).length,
		hitColumns: hit.columns.map((c: any) => [c.label, !!c.sortable]),
		hitRows: hit.rows.map((row: any) => row.map((c: any) => c.value)),
		tooltips
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano tables -***-')
	test.end()
})

for (const termType of ['geneExpression', 'singleCellCellType']) {
	tape(`${termType} tables`, test => {
		const t = getTables(termType, geDots, {}, {}, 'TP53')
		test.deepEqual(
			t.columns,
			[
				['Gene Name', true, false],
				['log₂(fold-change)', true, true],
				['Original p-value', true, false],
				['Adjusted p-value', true, false]
			],
			'p-value table columns'
		)
		test.deepEqual(
			t.rows,
			[
				['TP53', r(1.23456), r(0.000123456), r(0.00234567)],
				['KRAS', r(-0.5), r(0.02), '']
			],
			'p-value table rows, sorted by fold-change, with no adjusted p left blank'
		)
		test.deepEqual(t.rowKeys, ['TP53', 'KRAS'], 'rows keyed by gene')
		test.equal(t.highlighted, 1, 'a highlighted gene is found by its key')
		test.deepEqual(
			t.hitColumns,
			[
				['Gene', false],
				['log₂(FC)', true],
				['Adjusted p-value', true]
			],
			'hover table columns'
		)
		test.deepEqual(
			t.hitRows,
			[
				['KRAS', r(-0.5), r(undefined as any)],
				['TP53', r(1.23456), r(0.00234567)]
			],
			'hover table rows, in dot order'
		)
		test.deepEqual(
			t.tooltips,
			[
				[
					['Gene name', 'KRAS'],
					['log<sub>2</sub>(fold-change)', r(-0.5)],
					['Original p-value', r(0.02)]
				],
				[
					['Gene name', 'TP53'],
					['log<sub>2</sub>(fold-change)', r(1.23456)],
					['Original p-value', r(0.000123456)],
					['Adjusted p-value', r(0.00234567)]
				]
			],
			'tooltips, leaving out a missing adjusted p'
		)
		test.end()
	})
}

tape('proteome tables', test => {
	const t = getTables('proteomeDAP', [dapDot], {}, {}, 'P04637')
	test.deepEqual(
		t.columns,
		[
			['Identifier', true, false],
			['Gene', true, false],
			['log₂(fold-change)', true, true],
			['FDR', true, false]
		],
		'p-value table columns, with the one FDR'
	)
	test.deepEqual(t.rows, [['P04637', 'TP53', r(0.8), r(0.01)]], 'p-value table rows')
	test.deepEqual(t.rowKeys, ['P04637'], 'rows keyed by identifier')
	test.equal(t.highlighted, 1, 'a highlighted protein is found by its key')
	test.deepEqual(
		t.hitColumns,
		[
			['Identifier', false],
			['Gene', false],
			['log₂(FC)', true],
			['FDR', true]
		],
		'hover table columns'
	)
	test.deepEqual(t.hitRows, [['P04637', 'TP53', r(0.8), r(0.01)]], 'hover table rows')
	test.deepEqual(
		t.tooltips,
		[
			[
				['Identifier', 'P04637'],
				['Gene', 'TP53'],
				['log<sub>2</sub>(fold-change)', r(0.8)],
				['FDR', r(0.01)]
			]
		],
		'tooltip'
	)
	test.end()
})

tape('dna methylation tables', test => {
	const label = formatPromoterLabel(dmDot as any)
	const columns = [
		['Promoter', true, false],
		['Gene(s)', true, false],
		['log₂(fold-change)', true, true],
		['Δβ', true, false],
		['Mean β (group 1)', true, false],
		['Mean β (group 2)', true, false],
		['Original p-value', true, false],
		['Adjusted p-value', true, false]
	]
	const rows = [[label, 'NKAP', r(0.62), r(0.123), r(0.4), r(0.523), r(0.0001), r(0.001)]]
	const pRows = [
		['Original p-value', r(0.0001)],
		['Adjusted p-value', r(0.001)]
	]

	const fc = getTables(
		'dnaMethylation',
		[dmDot],
		{ elementType: 'promoter', xAxis: 'fold_change' },
		{},
		dmDot.promoter_id
	)
	test.deepEqual(fc.columns, columns, 'p-value table columns')
	test.deepEqual(fc.rows, rows, 'p-value table rows')
	test.deepEqual(fc.rowKeys, [dmDot.promoter_id], 'rows keyed by element')
	test.equal(fc.highlighted, 1, 'a highlighted element is found by its key')
	test.deepEqual(
		fc.hitColumns,
		[
			['Promoter', false],
			['Gene(s)', false],
			['log₂(FC)', true],
			['Adjusted p-value', true]
		],
		'hover table columns on the fold-change axis'
	)
	test.deepEqual(fc.hitRows, [[label, 'NKAP', r(0.62), r(0.001)]], 'hover table rows on the fold-change axis')
	test.deepEqual(
		fc.tooltips,
		[[['Promoter', label], ['Gene(s)', 'NKAP'], ['log<sub>2</sub>(fold-change)', r(0.62)], ...pRows]],
		'tooltip on the fold-change axis'
	)

	const db = getTables('dnaMethylation', [dmDot], { elementType: 'promoter', xAxis: 'delta_beta' })
	test.deepEqual(db.columns, columns, 'p-value table columns are the same on the delta-beta axis')
	test.deepEqual(db.rows, rows, 'and so are its rows')
	test.deepEqual(
		db.hitColumns,
		[
			['Promoter', false],
			['Gene(s)', false],
			['Δβ', true],
			['Adjusted p-value', true]
		],
		'hover table columns on the delta-beta axis'
	)
	test.deepEqual(db.hitRows, [[label, 'NKAP', r(0.123), r(0.001)]], 'hover table rows on the delta-beta axis')
	test.deepEqual(
		db.tooltips,
		[[['Promoter', label], ['Gene(s)', 'NKAP'], ['Δβ', r(0.123)], ...pRows]],
		'tooltip on the delta-beta axis'
	)
	test.end()
})

tape('DMR scan tables', test => {
	const t = getTables('dnaMethylation', [scanDot], scanSettings, { scan }, scanDot.promoter_id)
	const p = 'HMFDR'
	test.deepEqual(
		t.columns,
		[
			['DMR', true, false],
			['Gene(s)', true, false],
			['Δβ', true, true],
			['Peak Δβ', true, false],
			['CpGs', true, false],
			['Width (bp)', true, false],
			[p, true, false]
		],
		'p-value table columns, the mean delta-beta drawn as the bar'
	)
	test.deepEqual(
		t.rows,
		[['chr1:1000-2000', 'GENEA, GENEB', r(-0.21), r(-0.35), 14, 1000, r(0.012)]],
		'p-value table rows'
	)
	test.deepEqual(t.rowKeys, ['chr1:1000-2000'], 'rows keyed by region')
	test.equal(t.highlighted, 1, 'a highlighted DMR is found by its key')
	test.deepEqual(
		t.hitColumns,
		[
			['DMR', false],
			['Gene(s)', false],
			['Δβ', true],
			[p, true]
		],
		'hover table columns'
	)
	test.deepEqual(t.hitRows, [['chr1:1000-2000', 'GENEA, GENEB', r(-0.21), r(0.012)]], 'hover table rows')
	test.deepEqual(
		t.tooltips,
		[
			[
				['DMR', 'chr1:1000-2000'],
				['Gene(s)', 'GENEA, GENEB'],
				['Δβ', r(-0.21)],
				[p, r(0.012)],
				['Min smoothed FDR', r(0.004)]
			]
		],
		'tooltip, with the smoothed FDR when another statistic is plotted'
	)
	test.end()
})

tape('splicing tables', test => {
	const t = getTables('junction', [spliceDot], { method: 'leafcutter' }, {}, 'clu_1')
	test.deepEqual(
		t.columns,
		[
			['Cluster', true, false],
			['Gene(s)', true, false],
			['ΔPSI', true, true],
			['PSI (group 1)', true, false],
			['PSI (group 2)', true, false],
			['Junctions', true, false],
			['Original p-value', true, false],
			['Adjusted p-value', true, false]
		],
		'p-value table columns'
	)
	test.deepEqual(
		t.rows,
		[['clu_1', 'GENEA,GENEB', r(0.234), r(0.1), r(0.334), 3, r(0.003), r(0.03)]],
		'p-value table rows'
	)
	test.deepEqual(t.rowKeys, ['clu_1'], 'rows keyed by cluster')
	test.equal(t.highlighted, 1, 'a highlighted cluster is found by its key')
	test.deepEqual(
		t.hitColumns,
		[
			['Cluster', false],
			['Gene(s)', false],
			['ΔPSI', true],
			['Adjusted p-value', true]
		],
		'hover table columns'
	)
	test.deepEqual(t.hitRows, [['clu_1', 'GENEA,GENEB', r(0.234), r(0.03)]], 'hover table rows')
	test.deepEqual(
		t.tooltips,
		[
			[
				['Cluster', 'clu_1'],
				['Gene(s)', 'GENEA,GENEB'],
				['Position', 'chr2:10-90'],
				['ΔPSI', r(0.234)],
				['PSI (group 1)', r(0.1)],
				['PSI (group 2)', r(0.334)],
				['Junctions', 3],
				['Top intron', 'chr2:20-40'],
				['Original p-value', r(0.003)],
				['Adjusted p-value', r(0.03)]
			]
		],
		'tooltip'
	)
	test.end()
})
