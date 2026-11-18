import type { TermdbSingleCellDEgenesRequest } from '#types'
import { SINGLECELL_GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#types'
// the server groups the single-cell terms of termdbConfig.termType2terms by these
import { TermTypeGroups } from '#shared/terms.js'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import type { VolcanoHandler } from './types'
import { geneIdColumns, geneTooltipRows } from './shared'

/** Differential gene expression of a cell category in one single-cell sample */
export const singleCellCellTypeHandler: VolcanoHandler = {
	termType: tt.SINGLECELL_CELLTYPE,
	route: 'termdb/singlecellDEgenes',
	comparesGroups: false,

	getRequestBody(ctx): TermdbSingleCellDEgenesRequest {
		const { app, config } = ctx
		return {
			genome: app.vocabApi.vocab.genome,
			dslabel: app.vocabApi.vocab.dslabel,
			sample: config.sample,
			termId: config.termId,
			categoryName: config.categoryName,
			volcanoRender: ctx.getVolcanoRender()
		}
	},

	getRowNoun: () => 'genes',
	actions: ['highlight', 'statistics', 'pValueTable'],
	gsea: true,

	getRowKey: d => d.gene_name,
	getIdColumns: () => geneIdColumns,
	getTooltipRows: (d, _run, shared) => geneTooltipRows(d, shared),

	leavesOutControls: ['defaultSignColor'],
	getPlotConfig: (opts, app) => ({
		//TODO: Fix this logic
		sample: opts.experimentID || opts.sample || opts.samples?.[0]?.experiments[0]?.experimentID,
		termId: app.vocabApi.termdbConfig.queries.singleCell.DEgenes.termId,
		//TODO: 'Cluster' is a fallback for development
		//Should require opts.categoryName in the future
		categoryName: opts.categoryName || 'Cluster'
	}),

	/* quick fix - this only works for gdc's precomputed DE genes (selected cluster vs rest of cells)
	this won't work for dynamic DE (user-selected cluster A vs cluster B)
	thus not okay to hardcode `Not in` here
	!! FIXME !!
	sc should come up with actual names, and cell counts, for precompute/dynamic groups
	*/
	getGroupLabels(config) {
		const groupLabel = `${config.termId} ${config.categoryName}`
		return [`Not in ${groupLabel}`, groupLabel]
	},

	/* the expression of a gene across the cells of the sample, split into the two groups that the
	analysis compared, on a dataset with single-cell gene expression */
	getRowActions(d, ctx) {
		const { config, termdbConfig } = ctx
		if (!d.gene_name || !termdbConfig?.queries?.singleCell?.geneExpression || !config?.sample) return []
		const term = getGeneExpressionTw(d.gene_name, config, termdbConfig)
		const term2 = getGroupsTw(config, termdbConfig)
		const summary = (childType: 'violin' | 'boxplot') => ({
			chartType: 'summary',
			childType,
			term,
			...(term2 ? { term2 } : {}),
			// a cohort filter applies only to the cells of a meta result, which map to cohort samples
			hidePlotFilter: !config.sample.isMetaResult
		})
		return [
			{ label: 'Violin plot', onClick: async () => ctx.interactions.launchPlot(summary('violin')) },
			{ label: 'Box plot', onClick: async () => ctx.interactions.launchPlot(summary('boxplot')) }
		]
	}
}

/** the single-cell expression of a gene in the sample of the analysis */
function getGeneExpressionTw(gene: string, config: any, termdbConfig: any) {
	// as getSCGEunit() in #tw/singleCellGeneExpression
	const unit = termdbConfig.queries.singleCell.geneExpression.unit || 'Gene Expression'
	return {
		q: { mode: 'continuous' },
		term: { type: SINGLECELL_GENE_EXPRESSION, gene, name: `${gene} ${unit}`, sample: config.sample, unit }
	}
}

/** The cell type term of the analysis, split into the analyzed category and the other categories,
 * named as the volcano names them. Undefined when the dataset has no such term, and the plot is
 * then of all the cells. With no category list to split, the term lists each category. */
function getGroupsTw(config: any, termdbConfig: any) {
	const terms = termdbConfig.termType2terms?.[TermTypeGroups.SINGLECELL_CELLTYPE] || []
	const t = terms.find((t: any) => t.type == SINGLECELL_CELLTYPE && t.name == config.termId)
	if (!t) return
	const term = { ...t, sample: config.sample }
	const values = Object.values(t.values || {}) as { key: string; label?: string }[]
	const category = values.find(v => v.key == config.categoryName)
	if (!category) return { term }
	const [rest, analyzed] = singleCellCellTypeHandler.getGroupLabels!(config, undefined)
	const group = (name: string, vs: typeof values) => ({
		name,
		type: 'values',
		values: vs.map(v => ({ key: v.key, label: v.label || v.key }))
	})
	return {
		term,
		q: {
			type: 'custom-groupset',
			customset: {
				groups: [
					group(
						rest,
						values.filter(v => v !== category)
					),
					group(analyzed, [category])
				]
			}
		}
	}
}
