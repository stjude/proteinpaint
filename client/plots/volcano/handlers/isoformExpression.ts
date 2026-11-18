import { ISOFORM_EXPRESSION } from '#types'
import type { ClusterTerms, RowActionContext, TooltipRow, VolcanoHandler } from './types'
import { geneExpressionHandler } from './geneExpression'

/** Differential isoform expression on bulk RNA-seq transcript counts, from ds.queries.isoformExpressionCount. The
 * analysis is gene expression's, on transcripts: the same route, methods, filters and confounders. A row keeps the
 * transcript id as gene_name, the item that the DE engines report, and the server names its gene as row.gene. */
export const isoformExpressionHandler: VolcanoHandler = {
	...geneExpressionHandler,
	termType: ISOFORM_EXPRESSION,

	async getRequestBody(ctx) {
		const body = await geneExpressionHandler.getRequestBody(ctx)
		return { ...body, termType: ISOFORM_EXPRESSION }
	},

	getRowNoun: () => 'isoforms',
	getSignificantNoun: () => 'DE isoforms',
	// no highlight: it highlights a gene set, and a row is a transcript
	actions: ['confounders', 'statistics', 'pValueTable', 'clustering'],
	// a gene ranking: several transcripts of a gene would rank it more than once
	gsea: false,

	getRowKey: d => d.gene_name,
	getIdColumns: () => [
		{ label: 'Isoform', value: d => d.gene_name || '' },
		{ label: 'Gene', value: d => d.gene || '' }
	],
	getTooltipRows(d, _run, shared) {
		const rows: TooltipRow[] = [['Isoform', d.gene_name]]
		if (d.gene) rows.push(['Gene', d.gene])
		return [...rows, shared.effect, ...shared.pValues]
	},

	// the expression of a transcript is the dataset's isoform expression, such as TPM, not its counts
	getRowActions(d, ctx) {
		if (!d.gene_name || !ctx.queries?.isoformExpression) return []
		const summary = (childType: 'violin' | 'boxplot') => ({
			chartType: 'summary',
			childType,
			term: { q: { mode: 'continuous' }, term: getIsoformTerm(d, ctx.termdbConfig) },
			term2: { q: { groups: ctx.config.tw.q.groups, type: 'custom-samplelst' }, term: ctx.config.tw.term }
		})
		return [
			{ label: 'Violin plot', onClick: async () => ctx.interactions.launchPlot(summary('violin')) },
			{ label: 'Box plot', onClick: async () => ctx.interactions.launchPlot(summary('boxplot')) }
		]
	},

	clusterTerms: {
		dataType: ISOFORM_EXPRESSION,
		/* A transcript without a gene is one that the genome's annotation does not have. It is left out: the server
		refuses a request that names an isoform the genome does not know (geneRefValidation.ts) */
		getTerm: (d, vocabApi) => (d.gene ? getIsoformTerm(d, vocabApi.termdbConfig) : undefined),
		isAvailable: termdbConfig => !!termdbConfig?.queries?.isoformExpression
	} satisfies ClusterTerms,

	preAnalysis: {
		...geneExpressionHandler.preAnalysis,
		getPreferredMethod: termdbConfig => termdbConfig?.queries?.isoformExpressionCount?.defaultMethod
	}
}

/** the isoform expression term of a row, in the unit of the dataset's isoform expression */
function getIsoformTerm(d: any, termdbConfig: RowActionContext['termdbConfig']) {
	const unit = termdbConfig?.queries?.isoformExpression?.unit || 'Isoform Expression'
	return {
		type: ISOFORM_EXPRESSION,
		isoform: d.gene_name,
		...(d.gene ? { gene: d.gene } : {}),
		name: `${d.gene_name} ${unit}`,
		unit
	}
}
