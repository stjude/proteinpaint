import type { DERequest } from '#types'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import type { VolcanoHandler } from './types'
import { countGroupSamples, geneIdColumns, geneTooltipRows, methylationLocusAction } from './shared'

/** Differential gene expression on bulk RNA-seq counts, or on a single-cell pseudobulk category */
export const geneExpressionHandler: VolcanoHandler = {
	termType: tt.GENE_EXPRESSION,
	route: 'termdb/DE',
	comparesGroups: true,

	getRequestBody(ctx) {
		const { app, config, settings } = ctx
		ctx.setOthersGroup(config.samplelst)
		const state = app.getState()
		const body = {
			kind: 'DE',
			genome: app.vocabApi.vocab.genome,
			dslabel: app.vocabApi.vocab.dslabel,
			method: settings.method,
			min_count: settings.minCount,
			min_total_count: settings.minTotalCount,
			samplelst: config.samplelst,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			cpm_cutoff: settings.cpmCutoff,
			volcanoRender: ctx.getVolcanoRender()
		} as Partial<DERequest> //remove Partial when storage_type is removed from DERequest
		const pseudobulk = config.tw?.pseudobulk
		if (pseudobulk) body.pseudobulk = pseudobulk

		ctx.addConfounderTw(body)

		return body
	},

	getRowNoun: () => 'genes',
	getSignificantNoun: () => 'DE genes',
	actions: ['confounders', 'highlight', 'statistics', 'pValueTable', 'clustering'],
	// wilcoxon adjusts for no covariate, and edgeR is offered confounders on up to 100 samples only
	getHiddenActions({ settings, config }) {
		if (settings.method == 'wilcoxon') return ['confounders']
		if (settings.method == 'edgeR' && countGroupSamples(config.samplelst.groups) > 100) return ['confounders']
		return []
	},
	gsea: true,

	getRowKey: d => d.gene_name,
	getIdColumns: () => geneIdColumns,
	getTooltipRows: (d, _run, shared) => geneTooltipRows(d, shared),
	getProvenance: s => [`method: ${s.method}`],

	addDefaultSettings(defaults) {
		const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
		const method = features?.runDE_methods?.includes('Wilcoxon') ? 'wilcoxon' : 'edgeR'

		defaults.cpmCutoff = 1
		defaults.method = method
		defaults.minCount = 10
		defaults.minTotalCount = 15
		defaults.rankBy = 'abs(foldChange)'
	},
	getControlInputs: () => [
		{
			label: 'Minimum read count',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'minCount',
			title: 'The smallest number of reads required for a gene to be considered in the analysis',
			min: 0,
			max: 10000
		},
		{
			label: 'Minimum total read count',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'minTotalCount',
			title: 'The smallest total number of reads required for a gene to be considered in the analysis',
			min: 0,
			max: 10000
		},
		{
			label: 'CPM cutoff',
			type: 'number',
			chartType: 'volcano',
			settingsKey: 'cpmCutoff',
			title: 'The minimum normalized expression threshold to retain only genes with sufficient expression',
			min: 0
		},
		{
			label: 'Method',
			type: 'radio',
			chartType: 'volcano',
			settingsKey: 'method',
			title: 'Toggle between analysis methods',
			options: getMethodOptions()
		}
		// {
		// 	label: 'Rank Genes by',
		// 	type: 'radio',
		// 	chartType: 'volcano',
		// 	settingsKey: 'rankBy',
		// 	title: 'Rank genes by either the absolute value of the fold change or the variance',
		// 	options: [
		// 		{ label: 'abs(Fold Change)', value: 'abs(foldChange)' },
		// 		{ label: 'Variance', value: 'variance' }
		// 	],
		// 	//TODO: will enable this feature when there is backhand support
		// 	getDisplayStyle: () => 'none'
		// }
	],

	getRowActions: (d, ctx) => [
		{ label: 'Violin plot', onClick: async () => ctx.interactions.launchViolinGeneExp(d.gene_name) },
		{ label: 'Box plot', onClick: async () => ctx.interactions.launchBoxPlot(d.gene_name) },
		...methylationLocusAction(d.gene_name, ctx)
	],

	preAnalysis: {
		/* Every method is listed, and one that cannot run on these groups is grayed out with the reason
		as its tooltip: small groups rule out wilcoxon here, and the server lists the methods that would
		be refused for memory */
		getMethodOptions({ numControl, numCase, lowMemoryMethods, sampleLabel }) {
			const sample_size_limit = 8
			const total = numControl + numCase
			return [
				{ label: 'edgeR', value: 'edgeR' },
				{ label: 'Wilcoxon', value: 'wilcoxon' },
				{ label: 'Limma', value: 'limma' }
			].map(o => {
				const reason =
					numControl <= sample_size_limit && numCase <= sample_size_limit && o.value == 'wilcoxon'
						? `Wilcoxon needs more than ${sample_size_limit} ${sampleLabel} in at least one group`
						: lowMemoryMethods.includes(o.value)
						? `Server memory is too low to run ${o.label} on ${total} ${sampleLabel}`
						: ''
				return reason ? { ...o, disabled: true, reason } : o
			})
		},
		/* gdc prefers wilcoxon because its cohorts are large enough that edgeR's estimateDisp dominates
		(measured ~25x slower on a 1370-case cohort) */
		getPreferredMethod: termdbConfig => termdbConfig?.queries?.rnaseqGeneCount?.defaultMethod
	}
}

/** the analysis methods of the volcano's control: the ones that the server offers, or all of them */
function getMethodOptions() {
	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') as string)
	if (features?.runDE_methods?.length) {
		const opts: { label: string; value: string }[] = []
		for (const m of features.runDE_methods) {
			opts.push({ label: m, value: m.toLowerCase() })
		}
		return opts
	}
	// every method has the same sample limit (maxDESampleCutoff in #shared), which the run was already within
	return [
		{ label: 'edgeR', value: 'edgeR' },
		{ label: 'Wilcoxon', value: 'wilcoxon' },
		{ label: 'Limma', value: 'limma' }
	]
}
