import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import type { TooltipRow, VolcanoHandler } from './types'

/** Differential protein abundance, precomputed for one proteome cohort */
export const proteomeDAPHandler: VolcanoHandler = {
	termType: tt.PROTEOME_DAP,
	route: 'termdb/dapVolcano',
	comparesGroups: false,

	getRequestBody(ctx) {
		const { organism, assay, cohort } = ctx.config.proteomeDetails
		return {
			genome: ctx.app.vocabApi.vocab.genome,
			dslabel: ctx.app.vocabApi.vocab.dslabel,
			organism,
			assay,
			cohort,
			volcanoRender: ctx.getVolcanoRender()
		}
	},

	getRowNoun: () => 'proteins',
	// DAP files carry a single FDR
	fdrOnly: true,
	actions: [],
	gsea: false,

	// a row is a protein, named by its identifier, with the gene that codes it
	getRowKey: d => d.gene_name,
	getIdColumns: () => [
		{ label: 'Identifier', value: d => d.gene_name || '' },
		{ label: 'Gene', value: d => d.gene || '' }
	],
	getTooltipRows(d, _run, shared) {
		const rows: TooltipRow[] = [['Identifier', d.gene_name]]
		if ('gene' in d) rows.push(['Gene', d.gene])
		return [...rows, shared.effect, ...shared.pValues]
	},

	// FIXME this shouldn't be needed. there should be a way for caller to supply names for each group
	getGroupLabels: (_config, response) => [`Control (${response.sample_size1})`, `Case (${response.sample_size2})`],
	sampleSizeLabels: ['Control sample size', 'Case sample size']
}
