import type { TermdbSingleCellDEgenesRequest } from '#types'
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
	}
}
