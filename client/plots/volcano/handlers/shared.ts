import type { ActionMenuItem } from '#dom'
import type { RowActionContext, SharedTooltipRows, TooltipRow, VolcanoColumn, VolcanoHandler } from './types'

/** the labels of each effect size that the x axis can plot: in the hover table, the tooltip, and the
 * provenance line of a download, which is plain text */
const EFFECT_LABELS = {
	fold_change: { short: 'log₂(FC)', tooltip: 'log<sub>2</sub>(fold-change)', provenance: 'log2(fold-change)' },
	delta_beta: { short: 'Δβ', tooltip: 'Δβ', provenance: 'delta-beta' },
	delta_psi: { short: 'ΔPSI', tooltip: 'ΔPSI', provenance: 'delta-PSI' }
}

/** The effect size that the x axis plots: the row field, the header of the hover table, and the
 * label of the tooltip row. The hover table and the tooltip report the plotted effect size, which
 * the p-value table may not lead with: methylation on the delta-beta axis still leads its table
 * with the fold-change. */
export function getPlottedEffect(handler: VolcanoHandler, settings: any) {
	const field = handler.getEffectAxis?.(settings).xField || 'fold_change'
	return { field, ...EFFECT_LABELS[field] }
}

/** the column of a row named by its gene: gene expression, and the genes of a single-cell cell type */
export const geneIdColumns: VolcanoColumn[] = [{ label: 'Gene Name', short: 'Gene', value: d => d.gene_name || '' }]

/** the tooltip of a row named by its gene */
export function geneTooltipRows(d: any, shared: SharedTooltipRows): TooltipRow[] {
	return [['Gene name', d.gene_name], shared.effect, ...shared.pValues]
}

/** The samples of the groups: a group defined by a filter lists no sample, and carries the number
 * that its filter selected */
export function countGroupSamples(groups: any[] = []): number {
	return groups.reduce((sum: number, g: any) => sum + (g.values?.length ?? g.sampleCount ?? 0), 0)
}

/** Per-sample methylation along a gene, next to its expression, on a dataset with both. geneName may
 * list several genes, as a methylation element does: the first is the one it is named for */
export function methylationLocusAction(geneName: string | undefined, ctx: RowActionContext): ActionMenuItem[] {
	const gene = geneName?.split(',')[0]?.trim()
	const q = ctx.queries
	if (!gene || q?.dnaMethylation?.regionAnalysis != 'cpg' || !q?.geneExpression) return []
	return [
		{
			label: `Methylation & expression at ${gene}`,
			onClick: async () => ctx.interactions.launchMethylationLocus({ gene }, ctx.scan?.bedjFile)
		}
	]
}
