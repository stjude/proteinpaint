import { roundValueAuto } from '#shared/roundValue.js'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { DataPointEntry } from '../VolcanoTypes'
import { DNA_METHYLATION, GENE_EXPRESSION } from '#shared/terms.js'

export type ActionMenuOpt = {
	label: string
	onClick: () => Promise<void> | void
}

/** Returns the per-data-point action menu items (Violin / DMR / Box-plot). Used
 * by both the single-gene click flow and the multi-gene click-menu rows so the
 * launchers stay in lock-step. */
export function getActionMenuOpts(
	d: DataPointEntry,
	termType: string,
	interactions: VolcanoInteractions
): ActionMenuOpt[] {
	const all = [
		{
			label: 'Violin plot',
			isVisible: () => termType === DNA_METHYLATION || termType === GENE_EXPRESSION,
			onClick: async () => {
				if (termType === DNA_METHYLATION) interactions.launchDNAMethViolin(d as any)
				if (termType === GENE_EXPRESSION) interactions.launchViolinGeneExp(d.gene_name)
			}
		},
		{
			label: 'DMR analysis',
			isVisible: () => termType === DNA_METHYLATION,
			onClick: async () => {
				const dm = d as DataPointEntry & {
					chr: string
					start: number
					stop: number
					promoter_id?: string
					gene_name?: string
				}
				await interactions.launchDmr({
					chr: dm.chr,
					start: dm.start,
					stop: dm.stop,
					promoterId: dm.promoter_id
				})
			}
		},
		{
			label: 'Box plot',
			isVisible: () => termType === GENE_EXPRESSION,
			onClick: async () => {
				interactions.launchBoxPlot(d.gene_name)
			}
		}
	]
	return all.filter(o => o.isVisible()).map(({ label, onClick }) => ({ label, onClick }))
}

/** Populates a `table2col` instance with the standard volcano hover rows
 * (gene/promoter, fold-change, original + adjusted p-values). */
export function addTooltipRows(d: DataPointEntry, table: any, termType: string) {
	if (termType === DNA_METHYLATION) {
		if ('promoter_id' in d) addTooltipRow(table, 'Promoter', (d as any).promoter_id)
		if (d.gene_name) addTooltipRow(table, 'Gene(s)', d.gene_name)
	} else {
		addTooltipRow(table, 'Gene name', d.gene_name)
	}
	addTooltipRow(table, 'log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
	addTooltipRow(table, 'Original p-value', roundValueAuto(d.original_p_value))
	addTooltipRow(table, 'Adjusted p-value', roundValueAuto(d.adjusted_p_value))
}

function addTooltipRow(table: any, text: string, value: number | string) {
	const [td1, td2] = table.addRow()
	td1.html(text)
	td2.text(value)
}
