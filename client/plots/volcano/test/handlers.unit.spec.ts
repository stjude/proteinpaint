import tape from 'tape'
import { VolcanoModel } from '../model/VolcanoModel'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { getVolcanoHandler } from '../handlers'
import { VolcanoControlInputs } from '../VolcanoControlInputs'
import { DiffAnalysisView } from '../../diffAnalysis/view/DiffAnalysisView'
import { select } from 'd3-selection'

/* Tests:
	- the request body of each data type
	- the isoform expression handler
	- an unsupported data type is rejected
	- getVolcanoHandler()
	- p-value controls by data type
	- GSEA tab by data type
	- getRowKey() by data type
*/

const termfilter = {
	filter: { type: 'tvslst', in: true, join: '', lst: [] },
	filter0: { test: 'filter0' }
}

/** both groups list their samples, so setOthersGroup() leaves them as they are */
function getSamplelst() {
	return {
		groups: [
			{ name: 'group1', in: true, values: [{ sampleId: 1, sample: 'sample1' }] },
			{ name: 'group2', in: true, values: [{ sampleId: 2, sample: 'sample2' }] }
		]
	}
}

const confounderTws = [
	{ term: { id: 'conf1', type: 'categorical' }, q: { mode: 'discrete' } },
	{ term: { id: 'conf2', type: 'float' }, q: { mode: 'continuous' } }
]

function getModel(termType: string, config: any, settings: any) {
	const plot = {
		app: {
			getState: () => ({ termfilter }),
			vocabApi: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } }
		}
	}
	const model = new VolcanoModel(plot, termType)
	model.config = config
	model.settings = settings
	return model
}

/** the settings that every volcanoRender reads */
function getRenderSettings(overrides: any = {}) {
	return Object.assign(
		{
			pValue: 2,
			pValueType: 'adjusted',
			foldChangeCutoff: 1,
			width: 400,
			height: 320,
			defaultSignColor: 'red',
			defaultNonSignColor: 'black',
			maxInteractiveDots: 500
		},
		overrides
	)
}

/** the volcanoRender that getRenderSettings() makes, for a config whose term gives the groups no color */
function getExpectedRender(overrides: any = {}, thresholds: any = {}) {
	return Object.assign(
		{
			significanceThresholds: Object.assign(
				{ pValueCutoff: 2, pValueType: 'adjusted', foldChangeCutoff: 1 },
				thresholds
			),
			pixelWidth: 400,
			pixelHeight: 320,
			colorSignificant: '#ff0000',
			colorSignificantUp: '#0000ff',
			colorSignificantDown: '#ff0000',
			colorNonsignificant: '#000000',
			dotRadius: 5,
			maxInteractiveDots: 500,
			devicePixelRatio: window.devicePixelRatio * 2
		},
		overrides
	)
}

async function getRequestBody(model: VolcanoModel) {
	return await getVolcanoHandler(model.termType).getRequestBody(model)
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/handlers -***-')
	test.end()
})

tape('gene expression request body', async test => {
	const settings = getRenderSettings({ method: 'edgeR', minCount: 10, minTotalCount: 15, cpmCutoff: 1 })
	const config = { samplelst: getSamplelst(), confounderTws }
	const expected = {
		kind: 'DE',
		genome: 'hg38-test',
		dslabel: 'TermdbTest',
		method: 'edgeR',
		min_count: 10,
		min_total_count: 15,
		samplelst: getSamplelst(),
		filter: termfilter.filter,
		filter0: termfilter.filter0,
		cpm_cutoff: 1,
		volcanoRender: getExpectedRender(),
		tw: confounderTws[0],
		tw2: confounderTws[1]
	}
	test.deepEqual(
		await getRequestBody(getModel(tt.GENE_EXPRESSION, config, settings)),
		expected,
		'should send the DE parameters and both confounders'
	)

	const pseudobulk = { assay: 'scRNA', memberId: 'm1', category: 'T cell' }
	const pbConfig = { samplelst: getSamplelst(), tw: { pseudobulk } }
	const pbExpected: any = Object.assign({}, expected, { pseudobulk })
	delete pbExpected.tw
	delete pbExpected.tw2
	test.deepEqual(
		await getRequestBody(getModel(tt.GENE_EXPRESSION, pbConfig, settings)),
		pbExpected,
		'should send the pseudobulk category of the samplelst tw'
	)
	test.end()
})

tape('isoform expression request body', async test => {
	const settings = getRenderSettings({ method: 'edgeR', minCount: 10, minTotalCount: 15, cpmCutoff: 1 })
	const config = { samplelst: getSamplelst(), confounderTws }
	test.deepEqual(
		await getRequestBody(getModel(tt.ISOFORM_EXPRESSION, config, settings)),
		{
			kind: 'DE',
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			method: 'edgeR',
			min_count: 10,
			min_total_count: 15,
			samplelst: getSamplelst(),
			filter: termfilter.filter,
			filter0: termfilter.filter0,
			cpm_cutoff: 1,
			volcanoRender: getExpectedRender(),
			tw: confounderTws[0],
			tw2: confounderTws[1],
			termType: 'isoformExpression'
		},
		'should send the DE parameters of gene expression, with the isoform term type'
	)
	test.end()
})

tape('the isoform expression handler', test => {
	const h = getVolcanoHandler(tt.ISOFORM_EXPRESSION)
	const d = { gene_name: 'ENST00000269305', gene: 'TP53', fold_change: 1 }
	test.equal(h.route, 'termdb/DE', 'should run on the DE route')
	test.equal(h.getRowNoun({}), 'isoforms', 'should count isoforms')
	test.equal(h.getSignificantNoun!({}), 'DE isoforms', 'should caption the significant isoforms')
	test.deepEqual(
		h.getIdColumns({}).map(c => [c.label, c.value(d)]),
		[
			['Isoform', 'ENST00000269305'],
			['Gene', 'TP53']
		],
		'should name a row by its isoform and its gene'
	)
	const shared: any = { effect: ['effect', 1], pValues: [['p', 0.01]] }
	test.deepEqual(
		h.getTooltipRows(d, { settings: {} }, shared),
		[
			['Isoform', 'ENST00000269305'],
			['Gene', 'TP53'],
			['effect', 1],
			['p', 0.01]
		],
		'should list the isoform and its gene in the tooltip'
	)
	test.deepEqual(
		h.getTooltipRows({ gene_name: 'ENST1' }, { settings: {} }, shared),
		[
			['Isoform', 'ENST1'],
			['effect', 1],
			['p', 0.01]
		],
		'should leave out the gene of a transcript without one'
	)
	test.notOk(h.actions.includes('highlight'), 'should not offer the gene set highlight')
	test.ok(h.actions.includes('clustering'), 'should offer clustering')

	const vocabApi = { termdbConfig: { queries: { isoformExpression: { unit: 'TPM' } } } }
	test.deepEqual(
		h.clusterTerms!.getTerm(d, vocabApi),
		{ type: 'isoformExpression', isoform: 'ENST00000269305', gene: 'TP53', name: 'ENST00000269305 TPM', unit: 'TPM' },
		'should cluster a row by its isoform expression'
	)
	test.equal(
		h.clusterTerms!.getTerm({ gene_name: 'ENST1' }, vocabApi),
		undefined,
		'should leave out of clustering a transcript that the genome does not know'
	)
	test.equal(h.clusterTerms!.dataType, 'isoformExpression', 'should cluster isoform expression')
	test.ok(h.clusterTerms!.isAvailable!(vocabApi.termdbConfig), 'should offer clustering with isoform expression')
	test.notOk(h.clusterTerms!.isAvailable!({ queries: {} }), 'should not offer clustering without isoform expression')

	test.equal(
		h.preAnalysis!.getPreferredMethod!({ queries: { isoformExpressionCount: { defaultMethod: 'wilcoxon' } } }),
		'wilcoxon',
		'should prefer the method of the transcript counts'
	)
	test.equal(
		h.preAnalysis!.getPreferredMethod!({ queries: { rnaseqGeneCount: { defaultMethod: 'wilcoxon' } } }),
		undefined,
		'should not prefer the method of the gene counts'
	)
	test.end()
})

tape('dna methylation request body', async test => {
	const dmSettings = { minSamplesPerGroup: 3, excludeSexChr: true, deltaBetaCutoff: 0.1, centerDeltaBeta: true }
	const base = {
		kind: 'DM',
		genome: 'hg38-test',
		dslabel: 'TermdbTest',
		samplelst: getSamplelst(),
		filter: termfilter.filter,
		filter0: termfilter.filter0,
		min_samples_per_group: 3,
		exclude_sex_chr: true
	}

	{
		const settings = getRenderSettings({ ...dmSettings, elementType: 'promoter', xAxis: 'fold_change' })
		const config = { samplelst: getSamplelst(), confounderTws: [confounderTws[0]] }
		test.deepEqual(
			await getRequestBody(getModel(tt.DNA_METHYLATION, config, settings)),
			{ ...base, volcanoRender: getExpectedRender(), tw: confounderTws[0] },
			'should leave out the default element type, and plot fold-change when that axis is chosen'
		)
	}

	{
		const settings = getRenderSettings({ ...dmSettings, elementType: 'promoter_pls', xAxis: 'delta_beta' })
		const config = { samplelst: getSamplelst() }
		test.deepEqual(
			await getRequestBody(getModel(tt.DNA_METHYLATION, config, settings)),
			{
				...base,
				element_type: 'promoter_pls',
				volcanoRender: getExpectedRender({ xField: 'delta_beta', centerX: true }, { foldChangeCutoff: 0.1 })
			},
			'should send a non-default element type, and threshold and center the delta-beta axis'
		)
	}

	{
		const settings = getRenderSettings({
			...dmSettings,
			elementType: DMR_SCAN_ELEMENT_TYPE,
			xAxis: 'fold_change',
			scanChromosome: 'chr1',
			backgroundCorrection: true,
			scanYAxis: 'min_smoothed_fdr',
			minCpgs: 4,
			profileBinBp: 2000,
			lambda: 500,
			C: 2,
			fdrCutoff: 0.05
		})
		const config = { samplelst: getSamplelst(), confounderTws }
		test.deepEqual(
			await getRequestBody(getModel(tt.DNA_METHYLATION, config, settings)),
			{
				...base,
				element_type: DMR_SCAN_ELEMENT_TYPE,
				scan: {
					chromosome: 'chr1',
					backgroundCorrection: true,
					yAxis: 'min_smoothed_fdr',
					minCpgs: 4,
					minDeltaBeta: 0.1,
					profileBinBp: 2000,
					lambda: 500
				},
				volcanoRender: getExpectedRender({ xField: 'delta_beta' }, { foldChangeCutoff: 0.1 })
			},
			'should send the scan options that differ from the DMRcate defaults, uncentered, and no confounder'
		)
	}
	test.end()
})

tape('splicing request body', async test => {
	const settings = getRenderSettings({
		method: 'leafcutter',
		minSamplesPerIntron: 5,
		minSamplesPerGroup: 3,
		minCountsPerCluster: 30,
		deltaPsiCutoff: 0.05
	})
	const config = { samplelst: getSamplelst(), confounderTws: [confounderTws[0]] }
	test.deepEqual(
		await getRequestBody(getModel(tt.JUNCTION, config, settings)),
		{
			kind: 'DS',
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			samplelst: getSamplelst(),
			filter: termfilter.filter,
			filter0: termfilter.filter0,
			method: 'leafcutter',
			minSamplesPerIntron: 5,
			minSamplesPerGroup: 3,
			minCountsPerCluster: 30,
			volcanoRender: getExpectedRender({ xField: 'delta_psi' }, { foldChangeCutoff: 0.05 }),
			tw: confounderTws[0]
		},
		'should send the cluster filters and threshold the delta-PSI axis'
	)
	test.end()
})

tape('single-cell cell type request body', async test => {
	const config = { sample: 's1', termId: 'cluster', categoryName: '3' }
	test.deepEqual(
		await getRequestBody(getModel(tt.SINGLECELL_CELLTYPE, config, getRenderSettings())),
		{
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			sample: 's1',
			termId: 'cluster',
			categoryName: '3',
			volcanoRender: getExpectedRender()
		},
		'should send the sample and the cell category'
	)
	test.end()
})

tape('proteome request body', async test => {
	const config = { proteomeDetails: { organism: 'human', assay: 'TMT', cohort: 'c1', other: 'not sent' } }
	test.deepEqual(
		await getRequestBody(getModel(tt.PROTEOME_DAP, config, getRenderSettings())),
		{
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			organism: 'human',
			assay: 'TMT',
			cohort: 'c1',
			volcanoRender: getExpectedRender()
		},
		'should send the organism, assay and cohort'
	)
	test.end()
})

tape('unsupported data type', async test => {
	const model = getModel(tt.SINGLECELL_GENE_EXPRESSION, {}, getRenderSettings())
	try {
		await model.getData({}, getRenderSettings())
		test.fail('should throw')
	} catch (e: any) {
		test.equal(
			e.message,
			`Volcano plot does not support route for termType='${tt.SINGLECELL_GENE_EXPRESSION}'`,
			'should throw before any request'
		)
	}
	test.end()
})

tape('getVolcanoHandler()', test => {
	for (const termType of [
		tt.GENE_EXPRESSION,
		tt.ISOFORM_EXPRESSION,
		tt.DNA_METHYLATION,
		tt.JUNCTION,
		tt.SINGLECELL_CELLTYPE,
		tt.PROTEOME_DAP
	]) {
		test.equal(getVolcanoHandler(termType).termType, termType, `should find the handler of ${termType}`)
	}
	for (const termType of [tt.SINGLECELL_GENE_EXPRESSION, '__proto__', 'toString']) {
		test.throws(() => getVolcanoHandler(termType), /does not support route/, `should find no handler for ${termType}`)
	}
	test.end()
})

tape('p-value controls by data type', test => {
	const config: any = { samplelst: getSamplelst(), settings: { volcano: {} } }
	for (const termType of [
		tt.GENE_EXPRESSION,
		tt.ISOFORM_EXPRESSION,
		tt.DNA_METHYLATION,
		tt.JUNCTION,
		tt.SINGLECELL_CELLTYPE,
		tt.PROTEOME_DAP
	]) {
		const inputs = new VolcanoControlInputs({ ...config, termType }, termType).inputs
		const pValue = inputs.find(i => i.settingsKey == 'pValue')!
		const pValueType = inputs.find(i => i.settingsKey == 'pValueType')!
		const isFdr = termType == tt.PROTEOME_DAP
		test.equal(
			pValue.label,
			isFdr ? 'FDR significance (-log₁₀)' : 'P value significance (-log₁₀)',
			`${termType} should label its significance cutoff`
		)
		test.equal(
			pValue.title,
			isFdr
				? 'The FDR threshold to determine statistical significance'
				: 'The p-value threshold to determine statistical significance',
			`${termType} should describe its significance cutoff`
		)
		test.equal(
			(pValueType as any).getDisplayStyle({ settings: { volcano: {} } }),
			isFdr ? 'none' : '',
			`${termType} should ${isFdr ? 'hide' : 'show'} the p-value type`
		)
	}
	test.equal(
		(
			new VolcanoControlInputs({ ...config, termType: tt.DNA_METHYLATION }, tt.DNA_METHYLATION).inputs.find(
				i => i.settingsKey == 'pValueType'
			) as any
		).getDisplayStyle({ settings: { volcano: { elementType: DMR_SCAN_ELEMENT_TYPE } } }),
		'none',
		'a DMR scan should hide the p-value type'
	)
	test.end()
})

tape('GSEA tab by data type', test => {
	const holder: any = select(document.body).append('div')
	for (const [termType, visible] of [
		[tt.GENE_EXPRESSION, true],
		[tt.DNA_METHYLATION, true],
		[tt.SINGLECELL_CELLTYPE, true],
		[tt.JUNCTION, false],
		[tt.PROTEOME_DAP, false],
		[tt.ISOFORM_EXPRESSION, false]
	] as [string, boolean][]) {
		const view = new DiffAnalysisView(
			{} as any,
			{ termType, childType: 'volcano' } as any,
			{
				tabsDiv: holder.append('div')
			} as any
		)
		const gsea = view.tabsData.find(t => t.id == 'gsea') as any
		test.equal(gsea.isVisible(), visible, `${termType} should ${visible ? 'show' : 'hide'} the GSEA tab`)
	}
	holder.remove()
	test.end()
})

tape('GSEA tab is hidden when the server cannot run a GSEA method', test => {
	const holder: any = select(document.body).append('div')
	for (const [unavailable, visible] of [
		[['blitzgsea'], true],
		[['cerno', 'ora'], true],
		[['blitzgsea', 'cerno', 'ora'], false]
	] as [string[], boolean][]) {
		const view = new DiffAnalysisView(
			{ vocabApi: { termdbConfig: { unavailable } } } as any,
			{ termType: tt.GENE_EXPRESSION, childType: 'volcano' } as any,
			{
				tabsDiv: holder.append('div')
			} as any
		)
		const gsea = view.tabsData.find(t => t.id == 'gsea') as any
		test.equal(
			gsea.isVisible(),
			visible,
			`unavailable=[${unavailable}] should ${visible ? 'show' : 'hide'} the GSEA tab`
		)
	}
	holder.remove()
	test.end()
})

tape('getRowKey() by data type', test => {
	const cases: [string, any, string][] = [
		[tt.GENE_EXPRESSION, { gene_name: 'TP53' }, 'TP53'],
		[tt.ISOFORM_EXPRESSION, { gene_name: 'ENST00000269305', gene: 'TP53' }, 'ENST00000269305'],
		[tt.SINGLECELL_CELLTYPE, { gene_name: 'CD3E' }, 'CD3E'],
		[tt.PROTEOME_DAP, { gene_name: 'P04637', gene: 'TP53' }, 'P04637'],
		[tt.DNA_METHYLATION, { promoter_id: 'NKAP.p4_chrX:100-200', gene_name: 'NKAP' }, 'NKAP.p4_chrX:100-200'],
		/* a cluster names no gene_name: the p-value table row hover and the hover and click tables
		looked it up by gene_name, and so matched no dot */
		[tt.JUNCTION, { cluster_id: 'clu_1', genes: 'GENEA' }, 'clu_1']
	]
	for (const [termType, d, key] of cases) {
		test.equal(getVolcanoHandler(termType).getRowKey(d), key, `a ${termType} row should be keyed by ${key}`)
	}
	test.end()
})
