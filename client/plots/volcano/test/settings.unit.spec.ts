import tape from 'tape'
import { getDefaultVolcanoSettings, validateVolcanoSettings, getSampleNum } from '../settings/defaults'
import { VolcanoControlInputs } from '../VolcanoControlInputs'
import { getPlotConfig } from '../Volcano'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { DEFAULT_MIN_CPGS } from '#types'
import { maxSampleCutoff } from '#shared'

/* Tests:
	- getDefaultVolcanoSettings() by data type
	- validateVolcanoSettings() by data type
	- getSampleNum() by data type
	- the control inputs by data type
	- getPlotConfig() by data type
*/

const base = {
	defaultSignColor: 'red',
	defaultNonSignColor: 'black',
	defaultHighlightColor: '#ffa200',
	foldChangeCutoff: 0.3,
	height: 400,
	pValue: 1.3,
	pValueType: 'adjusted',
	showPValueTable: false,
	width: 400,
	maxInteractiveDots: 5000,
	maxTooltipGenes: 5
}

/** runs fn with sessionStorage.optionalFeatures set to features, restoring it after */
function withFeatures(features: any, fn: () => void) {
	const saved = sessionStorage.getItem('optionalFeatures')
	sessionStorage.setItem('optionalFeatures', JSON.stringify(features))
	try {
		fn()
	} finally {
		if (saved == null) sessionStorage.removeItem('optionalFeatures')
		else sessionStorage.setItem('optionalFeatures', saved)
	}
}

function groupsOf(n1: number, n2: number) {
	const values = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ sampleId: `${prefix}${i}` }))
	return [
		{ name: 'g1', in: true, values: values(n1, 'a') },
		{ name: 'g2', in: true, values: values(n2, 'b') }
	]
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/settings -***-')
	test.end()
})

tape('getDefaultVolcanoSettings() by data type', test => {
	withFeatures({}, () => {
		const ge = { cpmCutoff: 1, method: 'edgeR', minCount: 10, minTotalCount: 15, rankBy: 'abs(foldChange)' }
		test.deepEqual(
			getDefaultVolcanoSettings({}, { termType: tt.GENE_EXPRESSION }),
			{ ...base, ...ge },
			'gene expression adds the count filters and edgeR'
		)
		const dm = {
			minSamplesPerGroup: 3,
			excludeSexChr: false,
			centerDeltaBeta: false,
			elementType: 'promoter',
			xAxis: 'delta_beta',
			deltaBetaCutoff: 0.1,
			scanChromosome: '',
			backgroundCorrection: false,
			scanYAxis: 'min_smoothed_fdr',
			minCpgs: DEFAULT_MIN_CPGS,
			lambda: 1000,
			C: 2,
			fdrCutoff: 0.05,
			profileBinBp: 100_000
		}
		test.deepEqual(
			getDefaultVolcanoSettings({}, { termType: tt.DNA_METHYLATION }),
			{ ...base, ...dm },
			'methylation adds the element, axis and scan settings'
		)
		const app = { vocabApi: { termdbConfig: { queries: { dnaMethylation: { defaultElementType: 'promoter_pls' } } } } }
		test.equal(
			(getDefaultVolcanoSettings({}, { termType: tt.DNA_METHYLATION, app }) as any).elementType,
			'promoter_pls',
			'methylation starts on the element class the dataset names'
		)
		test.deepEqual(
			getDefaultVolcanoSettings({}, { termType: tt.JUNCTION }),
			{
				...base,
				method: 'edgeR',
				minSamplesPerIntron: 5,
				minSamplesPerGroup: 3,
				minCountsPerCluster: 20,
				deltaPsiCutoff: 0.05
			},
			'splicing adds the cluster filters and edgeR'
		)
		for (const termType of [tt.SINGLECELL_CELLTYPE, tt.PROTEOME_DAP, tt.SINGLECELL_GENE_EXPRESSION, 'unknown']) {
			test.deepEqual(getDefaultVolcanoSettings({}, { termType }), base, `${termType} has the shared settings only`)
		}
		test.deepEqual(
			getDefaultVolcanoSettings({ method: 'limma', width: 500 }, { termType: tt.GENE_EXPRESSION }),
			{ ...base, ...ge, method: 'limma', width: 500 },
			'overrides win'
		)
	})
	withFeatures({ runDE_methods: ['edgeR', 'Wilcoxon'] }, () => {
		test.equal(
			(getDefaultVolcanoSettings({}, { termType: tt.GENE_EXPRESSION }) as any).method,
			'wilcoxon',
			'gene expression starts on wilcoxon when the server offers it'
		)
	})
	test.end()
})

tape('validateVolcanoSettings() by data type', test => {
	const over = groupsOf(maxSampleCutoff, 1)
	for (const termType of [tt.GENE_EXPRESSION, tt.DNA_METHYLATION, tt.JUNCTION]) {
		test.throws(
			() => validateVolcanoSettings({ termType, settings: { volcano: {} } }, { termType, samplelst: { groups: over } }),
			/limit/,
			`${termType} refuses groups over the sample limit`
		)
	}
	for (const termType of [tt.SINGLECELL_CELLTYPE, tt.PROTEOME_DAP]) {
		test.doesNotThrow(
			() => validateVolcanoSettings({ termType, settings: { volcano: {} } }, { termType, samplelst: { groups: over } }),
			`${termType} is not checked`
		)
	}
	test.doesNotThrow(
		() =>
			validateVolcanoSettings(
				{ termType: tt.GENE_EXPRESSION, settings: {} },
				{ termType: tt.GENE_EXPRESSION, samplelst: { groups: over } }
			),
		'a config without volcano settings is not checked'
	)

	const small = { samplelst: { groups: groupsOf(3, 3) } }
	for (const [min, expected] of [
		[2, 3],
		['x', 3],
		[4.5, 3],
		[5, 5]
	] as [any, number][]) {
		const volcano: any = { minSamplesPerGroup: min, elementType: 'enhancer' }
		validateVolcanoSettings(
			{ termType: tt.DNA_METHYLATION, settings: { volcano } },
			{ termType: tt.DNA_METHYLATION, ...small }
		)
		test.equal(volcano.minSamplesPerGroup, expected, `methylation minSamplesPerGroup=${min} becomes ${expected}`)
		test.equal(volcano.elementType, 'enhancer', 'and keeps an element class')
	}
	const noClass: any = { minSamplesPerGroup: 3, elementType: '' }
	validateVolcanoSettings(
		{ termType: tt.DNA_METHYLATION, settings: { volcano: noClass } },
		{ termType: tt.DNA_METHYLATION, ...small }
	)
	test.equal(noClass.elementType, 'promoter', 'methylation falls back to the promoter class')

	const ds: any = { minSamplesPerIntron: 5, minSamplesPerGroup: 3 }
	validateVolcanoSettings(
		{ termType: tt.JUNCTION, settings: { volcano: ds } },
		{ termType: tt.JUNCTION, samplelst: { groups: groupsOf(300, 200) } }
	)
	test.deepEqual([ds.minSamplesPerIntron, ds.minSamplesPerGroup], [10, 5], 'splicing scales its sample filters')
	const dsOverride: any = { minSamplesPerIntron: 7, minSamplesPerGroup: 3 }
	validateVolcanoSettings(
		{ termType: tt.JUNCTION, settings: { volcano: dsOverride } },
		{ termType: tt.JUNCTION, samplelst: { groups: groupsOf(300, 200) }, overrides: { minSamplesPerIntron: 7 } }
	)
	test.deepEqual([dsOverride.minSamplesPerIntron, dsOverride.minSamplesPerGroup], [7, 5], 'an override is not scaled')
	const geVolcano: any = { minSamplesPerGroup: 1, elementType: '' }
	validateVolcanoSettings(
		{ termType: tt.GENE_EXPRESSION, settings: { volcano: geVolcano } },
		{ termType: tt.GENE_EXPRESSION, ...small }
	)
	test.deepEqual(geVolcano, { minSamplesPerGroup: 1, elementType: '' }, 'gene expression settings are left as they are')
	test.end()
})

tape('getSampleNum() by data type', test => {
	const groups = [
		{ name: 'listed', values: [{ sampleId: 1 }, { sampleId: 2 }] },
		{ name: 'by filter', filter: {}, sampleCount: 5 }
	]
	for (const termType of [tt.GENE_EXPRESSION, tt.DNA_METHYLATION, tt.JUNCTION]) {
		test.equal(getSampleNum({ termType, samplelst: { groups } }), 7, `${termType} counts its groups`)
	}
	for (const termType of [tt.SINGLECELL_CELLTYPE, tt.PROTEOME_DAP]) {
		test.equal(getSampleNum({ termType }), maxSampleCutoff, `${termType} has no groups to count`)
	}
	test.end()
})

tape('control inputs by data type', test => {
	const config = {
		samplelst: { groups: [{ name: 'g1' }, { name: 'g2' }] },
		tw: { term: { values: { g1: {}, g2: {} } } }
	}
	const elementTypes = [
		{ key: 'promoter', label: 'Promoter' },
		{ key: 'dmr_scan', label: 'DMR scan' }
	]
	const scanPlot = { settings: { volcano: { elementType: 'dmr_scan', backgroundCorrection: false } } }
	const elementPlot = { settings: { volcano: { elementType: 'promoter', backgroundCorrection: false } } }
	const show = (v: any) => v || 'show'
	const keys = (termType: string) =>
		new VolcanoControlInputs({ ...config, termType } as any, termType, elementTypes, ['chr1', 'chrM']).inputs.map(
			(i: any) =>
				i.settingsKey +
				(i.getDisplayStyle ? `:${show(i.getDisplayStyle(scanPlot))}/${show(i.getDisplayStyle(elementPlot))}` : '')
		)
	const tail = [
		'maxInteractiveDots',
		'height',
		'width',
		'defaultSignColor:show/show',
		'defaultNonSignColor',
		'defaultHighlightColor'
	]
	test.deepEqual(
		keys(tt.GENE_EXPRESSION),
		['minCount', 'minTotalCount', 'cpmCutoff', 'method', 'pValue', 'pValueType:none/show', 'foldChangeCutoff', ...tail],
		'gene expression'
	)
	test.deepEqual(
		keys(tt.DNA_METHYLATION),
		[
			'elementType',
			'scanChromosome:show/none',
			'backgroundCorrection:show/none',
			'scanYAxis:show/none',
			'minCpgs:show/none',
			'lambda:show/none',
			'C:show/none',
			'fdrCutoff:show/none',
			'profileBinBp:show/none',
			'minSamplesPerGroup:none/show',
			'excludeSexChr',
			'centerDeltaBeta:none/show',
			'deltaBetaCutoff',
			'pValue',
			'pValueType:none/show',
			...tail
		],
		'methylation, without a log2 cutoff'
	)
	test.deepEqual(
		keys(tt.JUNCTION),
		[
			'method',
			'minCountsPerCluster',
			'minSamplesPerIntron',
			'minSamplesPerGroup',
			'deltaPsiCutoff',
			'pValue',
			'pValueType:none/show',
			...tail
		],
		'splicing, without a log2 cutoff'
	)
	test.deepEqual(
		keys(tt.SINGLECELL_CELLTYPE),
		[
			'pValue',
			'pValueType:none/show',
			'foldChangeCutoff',
			'maxInteractiveDots',
			'height',
			'width',
			'defaultNonSignColor',
			'defaultHighlightColor'
		],
		'single-cell cell type, without the significant color, which it always hid'
	)
	test.deepEqual(
		keys(tt.PROTEOME_DAP),
		['pValue', 'pValueType:none/none', 'foldChangeCutoff', ...tail],
		'proteome, with no p-value type'
	)

	const inputOf = (termType: string, key: string) =>
		new VolcanoControlInputs({ ...config, termType } as any, termType, elementTypes, ['chr1', 'chrM']).inputs.find(
			(i: any) => i.settingsKey == key
		) as any
	test.deepEqual(
		inputOf(tt.DNA_METHYLATION, 'scanChromosome').options,
		[
			{ value: '', label: 'Whole genome' },
			{ value: 'chr1', label: 'chr1' }
		],
		'the scan offers the genome and its chromosomes but chrM'
	)
	test.equal(
		inputOf(tt.DNA_METHYLATION, 'scanYAxis').getDisplayStyle({
			settings: { volcano: { elementType: 'dmr_scan', backgroundCorrection: true } }
		}),
		'none',
		'the corrected scan has no y axis choice'
	)
	test.deepEqual(
		new VolcanoControlInputs({ ...config, termType: tt.DNA_METHYLATION } as any, tt.DNA_METHYLATION, [
			elementTypes[0]
		]).inputs.some((i: any) => i.settingsKey == 'elementType'),
		false,
		'one element class offers no choice'
	)
	test.deepEqual(
		inputOf(tt.JUNCTION, 'method').options.map(o => o.value),
		['edgeR', 'leafcutter'],
		'splicing methods'
	)
	withFeatures({}, () => {
		test.deepEqual(
			inputOf(tt.GENE_EXPRESSION, 'method').options,
			[
				{ label: 'edgeR', value: 'edgeR' },
				{ label: 'Wilcoxon', value: 'wilcoxon' },
				{ label: 'Limma', value: 'limma' }
			],
			'gene expression methods'
		)
	})
	withFeatures({ runDE_methods: ['edgeR', 'Wilcoxon'] }, () => {
		test.deepEqual(
			inputOf(tt.GENE_EXPRESSION, 'method').options,
			[
				{ label: 'edgeR', value: 'edger' },
				{ label: 'Wilcoxon', value: 'wilcoxon' }
			],
			'gene expression methods that the server offers'
		)
	})
	test.end()
})

tape('getPlotConfig() by data type', async test => {
	const app: any = { vocabApi: { termdbConfig: { queries: { singleCell: { DEgenes: { termId: 'cluster' } } } } } }
	const samplelst = { groups: groupsOf(3, 3) }
	for (const termType of [tt.GENE_EXPRESSION, tt.DNA_METHYLATION]) {
		const c: any = await getPlotConfig({ termType, samplelst }, app)
		test.deepEqual(c.confounderTws, [], `${termType} starts with no confounder`)
		test.deepEqual(c.samplelst, samplelst, `${termType} keeps its groups`)
		test.equal(c.sample, undefined, `${termType} names no single-cell sample`)
	}
	const ds: any = await getPlotConfig({ termType: tt.JUNCTION, samplelst }, app)
	test.equal(ds.confounderTws, undefined, 'splicing has no confounder list')
	const scct: any = await getPlotConfig({ termType: tt.SINGLECELL_CELLTYPE, sample: 's1' }, app)
	test.deepEqual(
		[scct.sample, scct.termId, scct.categoryName, scct.confounderTws],
		['s1', 'cluster', 'Cluster', undefined],
		'a cell type names its sample, term and category'
	)
	const dap: any = await getPlotConfig({ termType: tt.PROTEOME_DAP }, app)
	test.deepEqual([dap.sample, dap.confounderTws], [undefined, undefined], 'a proteome has neither')
	test.end()
})
