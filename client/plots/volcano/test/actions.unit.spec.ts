import tape from 'tape'
import { select } from 'd3-selection'
import { VolcanoPlotView } from '../view/VolcanoPlotView'
import { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import { VolcanoViewModel } from '../viewModel/VolcanoViewModel'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import * as testData from './testData'

/* Tests:
	- the click actions of a dot by data type
	- the click actions of a single-cell cell type gene
	- the box plot and violin of a gene
	- the download menu by data type
	- the group labels, sample size rows and provenance by data type
*/

const launchers = [
	'launchDNAMethViolin',
	'launchViolinGeneExp',
	'launchMethylationGenomeBrowser',
	'launchSpliceGenomeBrowser',
	'launchDmr',
	'launchBoxPlot',
	'launchMethylationLocus',
	'launchPlot'
]

/** the click actions of dot d, each as [label, the launcher it calls, its arguments] */
async function getActions(termType: string, d: any, queries: any, scan?: any, more: any = {}) {
	const calls: any[] = []
	const { config, termType2terms } = more
	const interactions: any = {
		id: 'v',
		app: {
			vocabApi: { termdbConfig: { queries, termType2terms } },
			getState: () => ({ plots: [{ id: 'v', ...config }] })
		}
	}
	for (const name of launchers) interactions[name] = (...args: any[]) => calls.push([name, ...args])
	const holder = select(document.body).append('div')
	const view: any = new VolcanoPlotView({ holder } as any, interactions, termType)
	view.viewData = { scan }
	const result: any[] = []
	for (const o of view.getActionMenuOpts(d)) {
		calls.length = 0
		await o.onClick()
		result.push([o.label, ...calls.flat()])
	}
	holder.remove()
	return result
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano actions -***-')
	test.end()
})

tape('click actions of a dot by data type', async test => {
	const cpg = { dnaMethylation: { regionAnalysis: 'cpg' }, geneExpression: {} }
	const gene = { gene_name: 'TP53', fold_change: 1 }
	test.deepEqual(
		await getActions(tt.GENE_EXPRESSION, gene, cpg),
		[
			['Violin plot', 'launchViolinGeneExp', 'TP53'],
			['Box plot', 'launchBoxPlot', 'TP53'],
			['Methylation & expression at TP53', 'launchMethylationLocus', { gene: 'TP53' }, undefined]
		],
		'a gene opens its violin, box plot, and methylation with expression on a cpg dataset'
	)
	test.deepEqual(
		await getActions(tt.GENE_EXPRESSION, gene, {}),
		[
			['Violin plot', 'launchViolinGeneExp', 'TP53'],
			['Box plot', 'launchBoxPlot', 'TP53']
		],
		'a gene opens no methylation without per-CpG data'
	)

	const element = { promoter_id: 'A.p1_chr1:1-2', gene_name: 'A, B', chr: 'chr1', start: 1, stop: 2 }
	test.deepEqual(
		await getActions(tt.DNA_METHYLATION, element, cpg),
		[
			['Violin plot', 'launchDNAMethViolin', element],
			['Genome browser', 'launchMethylationGenomeBrowser', element, undefined],
			['Methylation & expression at A', 'launchMethylationLocus', { gene: 'A' }, undefined]
		],
		'an element opens its violin, the browser, and its first gene'
	)
	const dmr = { promoter_id: 'chr1:10-20', gene_name: '', chr: 'chr1', start: 10, stop: 20 }
	const scan = { bedjFile: 'scan.bedj' }
	test.deepEqual(
		await getActions(tt.DNA_METHYLATION, dmr, { dnaMethylation: { regionAnalysis: 'cpg' } }, scan),
		[
			['Violin plot', 'launchDNAMethViolin', dmr],
			['Genome browser', 'launchMethylationGenomeBrowser', dmr, scan],
			['Differentially Methylated Region (DMR) Analysis', 'launchDmr', { chr: 'chr1', start: 10, stop: 20 }, scan],
			['Methylation at chr1:10-20', 'launchMethylationLocus', { chr: 'chr1', start: 10, stop: 20 }, 'scan.bedj']
		],
		'a scan DMR with no gene opens its region'
	)
	const cluster = { cluster_id: 'clu_1', genes: 'A' }
	test.deepEqual(
		await getActions(tt.JUNCTION, cluster, cpg),
		[['Genome browser', 'launchSpliceGenomeBrowser', cluster]],
		'a cluster opens the browser'
	)
	test.deepEqual(await getActions(tt.PROTEOME_DAP, gene, cpg), [], 'a proteome dot has no action')
	test.end()
})

tape('click actions of a single-cell cell type gene', async test => {
	const gene = { gene_name: 'CD74', fold_change: 1 }
	const sample = { sID: 's1', eID: 'e1' }
	const config = { termType: tt.SINGLECELL_CELLTYPE, sample, termId: 'Cluster', categoryName: 'Cluster 3' }
	const term = {
		q: { mode: 'continuous' },
		term: { type: 'singleCellGeneExpression', gene: 'CD74', name: 'CD74 UMI', sample, unit: 'UMI' }
	}
	const queries = { singleCell: { geneExpression: { unit: 'UMI' } } }
	const plotsOf = (actions: any[]) => actions.map(([label, launcher, plot]) => [label, launcher, plot.childType])

	test.deepEqual(
		await getActions(tt.SINGLECELL_CELLTYPE, gene, {}, undefined, { config }),
		[],
		'a gene has no action without single-cell gene expression'
	)

	const clusterTerm = { type: 'singleCellCellType', name: 'Cluster', plot: 'UMAP', values: {} }
	const all = await getActions(tt.SINGLECELL_CELLTYPE, gene, queries, undefined, {
		config,
		termType2terms: { 'Single-cell Cell Type': [clusterTerm] }
	})
	test.deepEqual(
		plotsOf(all),
		[
			['Violin plot', 'launchPlot', 'violin'],
			['Box plot', 'launchPlot', 'boxplot']
		],
		'a gene opens its violin and box plot'
	)
	test.deepEqual(
		all[0][2],
		{
			chartType: 'summary',
			childType: 'violin',
			term,
			term2: { term: { ...clusterTerm, sample } },
			hidePlotFilter: true
		},
		'of its expression in the sample, by each category of a term that lists none'
	)

	const values = {
		'Cluster 3': { key: 'Cluster 3', label: 'Cluster 3' },
		'Cluster 4': { key: 'Cluster 4', label: 'Cluster 4' },
		'Cluster 5': { key: 'Cluster 5' }
	}
	const split = await getActions(tt.SINGLECELL_CELLTYPE, gene, queries, undefined, {
		config,
		termType2terms: { 'Single-cell Cell Type': [{ ...clusterTerm, values }] }
	})
	test.deepEqual(
		split[1][2].term2.q,
		{
			type: 'custom-groupset',
			customset: {
				groups: [
					{
						name: 'Not in Cluster Cluster 3',
						type: 'values',
						values: [
							{ key: 'Cluster 4', label: 'Cluster 4' },
							{ key: 'Cluster 5', label: 'Cluster 5' }
						]
					},
					{ name: 'Cluster Cluster 3', type: 'values', values: [{ key: 'Cluster 3', label: 'Cluster 3' }] }
				]
			}
		},
		'split into the analyzed category and the rest, named as the volcano names them'
	)

	const noTerm = await getActions(tt.SINGLECELL_CELLTYPE, gene, queries, undefined, {
		config: { ...config, sample: { ...sample, isMetaResult: true } }
	})
	test.deepEqual(
		[noTerm[0][2].term2, noTerm[0][2].hidePlotFilter],
		[undefined, false],
		'of all the cells without the cell type term, and with the filter for a meta result'
	)
	test.end()
})

tape('the box plot and violin of a gene', test => {
	const dispatched: any[] = []
	const tw = { q: { groups: testData.groups }, term: { name: 'groups', type: 'samplelst' } }
	const app: any = {
		getState: () => ({
			plots: [{ id: 'v', termType: tt.GENE_EXPRESSION, samplelst: { groups: testData.groups }, tw }]
		}),
		dispatch: (a: any) => dispatched.push(a)
	}
	const interactions = new VolcanoInteractions(app, 'v', {} as any)
	interactions.launchBoxPlot('TP53')
	interactions.launchViolinGeneExp('TP53')
	const term = { q: { mode: 'continuous' }, term: { gene: 'TP53', name: 'TP53', type: tt.GENE_EXPRESSION } }
	const term2 = { q: { groups: testData.groups, type: 'custom-samplelst' }, term: tw.term }
	test.deepEqual(
		dispatched.map(a => [a.type, a.config.chartType, a.config.childType, a.config.term, a.config.term2]),
		[
			['plot_create', 'summary', 'boxplot', term, term2],
			['plot_create', 'summary', 'violin', term, term2]
		],
		'should plot the expression of the gene by the groups'
	)
	test.end()
})

tape('download menu by data type', test => {
	for (const [termType, tableLabel] of [
		[tt.GENE_EXPRESSION, 'Download p-value table'],
		[tt.DNA_METHYLATION, 'Download p-value table'],
		[tt.JUNCTION, 'Download p-value table'],
		[tt.SINGLECELL_CELLTYPE, 'Download p-value table'],
		[tt.PROTEOME_DAP, 'Download FDR table']
	]) {
		const holder = select(document.body).append('div')
		const tip = holder.append('div')
		const actionsTip: any = { d: tip, clear: () => actionsTip, showunder: () => actionsTip }
		const interactions = new VolcanoInteractions({} as any, 'v', {
			holder: holder.append('div'),
			controls: holder.append('div'),
			actionsTip
		} as any)
		interactions.download(termType)
		test.deepEqual(
			tip
				.selectAll('.sja_menuoption')
				.nodes()
				.map((n: any) => n.textContent),
			['Download plot', tableLabel],
			`${termType} should offer the plot and its ${tableLabel.slice(9)}`
		)
		holder.remove()
	}
	test.end()
})

const settings = {
	defaultSignColor: 'red',
	defaultNonSignColor: 'black',
	foldChangeCutoff: 0.3,
	height: 400,
	width: 400,
	pValue: 1.3,
	pValueType: 'adjusted',
	method: 'edgeR',
	elementType: 'promoter',
	xAxis: 'delta_beta',
	deltaBetaCutoff: 0.1,
	minSamplesPerGroup: 3,
	excludeSexChr: false,
	deltaPsiCutoff: 0.05,
	minSamplesPerIntron: 5,
	minCountsPerCluster: 20
}

function getViewModel(termType: string, extra: any = {}) {
	const dot = { gene_name: 'G', promoter_id: 'P', cluster_id: 'C', fold_change: 0.5, delta_beta: 0.2, delta_psi: 0.1 }
	const response: any = {
		data: {
			dots: [{ ...dot, original_p_value: 0.01, adjusted_p_value: 0.02, pixel_x: 1, pixel_y: 1 }],
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
			totalRows: 4,
			totalSignificantRows: 1,
			totalSignificantUp: 1,
			totalSignificantDown: 0,
			xOffset: 0,
			centered: false
		},
		images: [],
		method: termType == tt.JUNCTION ? 'leafcutter' : 'edgeR',
		sample_size1: 3,
		sample_size2: 4
	}
	const config = {
		termType,
		confounderTws: [],
		highlightedData: [],
		samplelst: { groups: testData.groups },
		tw: { q: { groups: testData.groups }, term: { values: {} } },
		termId: 'cluster',
		categoryName: '3',
		...extra
	}
	return new VolcanoViewModel(config as any, response, settings as any)
}

tape('group labels, sample size rows and provenance by data type', test => {
	const [g1, g2] = testData.groups.map((g: any) => g.name)
	const named = [`${g1} (3)`, `${g2} (4)`]
	const labels = (vm: VolcanoViewModel) => [vm.viewData.termInfo?.first.label, vm.viewData.termInfo?.second.label]
	const sizes = (vm: VolcanoViewModel) => vm.viewData.statsData.slice(3)
	const groupSizes = [
		{ label: `${g1} sample size (control group)`, value: 3 },
		{ label: `${g2} sample size (case group)`, value: 4 }
	]
	const groupsLine = `group1 (control) "${g1}" n=3; group2 (case) "${g2}" n=4; confounders: none`

	const ge = getViewModel(tt.GENE_EXPRESSION)
	test.deepEqual(labels(ge), named, 'gene expression names its groups above the plot')
	test.deepEqual(sizes(ge), groupSizes, 'and in its sample size rows')
	test.equal(
		ge.viewData.provenance,
		`${groupsLine}; method: edgeR; significance: adjusted p < 0.05, |log2(fold-change)| > 0.3`,
		'gene expression provenance'
	)

	const dm = getViewModel(tt.DNA_METHYLATION)
	test.deepEqual(labels(dm), named, 'methylation names its groups')
	test.deepEqual(sizes(dm), groupSizes, 'and its sample sizes')
	test.equal(
		dm.viewData.provenance,
		`${groupsLine}; element class: promoter; x axis: delta-beta; min samples per group: 3; exclude sex chromosomes: no; significance: adjusted p < 0.05, |delta-beta| > 0.1`,
		'methylation provenance'
	)

	const ds = getViewModel(tt.JUNCTION)
	test.deepEqual(labels(ds), named, 'splicing names its groups')
	test.deepEqual(sizes(ds), groupSizes, 'and its sample sizes')
	test.equal(
		ds.viewData.provenance,
		`${groupsLine}; method: leafcutter; min samples per intron: 5; min samples per group: 3; min counts per cluster: 20; significance: adjusted p < 0.05, |delta-PSI| > 0.05`,
		'splicing provenance names the engine that ran'
	)

	const dap = getViewModel(tt.PROTEOME_DAP)
	test.deepEqual(labels(dap), ['Control (3)', 'Case (4)'], 'a proteome labels control and case')
	test.deepEqual(
		sizes(dap),
		[
			{ label: 'Control sample size', value: 3 },
			{ label: 'Case sample size', value: 4 }
		],
		'and its sample sizes'
	)
	test.equal(
		dap.viewData.provenance,
		`${groupsLine}; significance: adjusted p < 0.05, |log2(fold-change)| > 0.3`,
		'proteome provenance'
	)

	const scct = getViewModel(tt.SINGLECELL_CELLTYPE)
	test.deepEqual(labels(scct), ['Not in cluster 3', 'cluster 3'], 'a cell type labels its category and the rest')
	test.deepEqual(sizes(scct), [], 'and has no sample size rows')
	test.end()
})
