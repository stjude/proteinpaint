import type { Menu } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { DataPointEntry } from '../VolcanoTypes'
import { DNA_METHYLATION } from '#shared/terms.js'

/** Populate a 2-column table with the tooltip rows for a data point. */
export function addTooltipRows(d: DataPointEntry, table: any, termType: string) {
	const addRow = (label: string, value: string | number) => {
		const [td1, td2] = table.addRow()
		td1.html(label)
		td2.text(value)
	}

	if (termType === DNA_METHYLATION) {
		const dm = d as any
		if (dm.promoter_id) addRow('Promoter', dm.promoter_id)
		if (d.gene_name) addRow('Gene(s)', d.gene_name)
	} else {
		addRow('Gene name', d.gene_name)
	}
	addRow('log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
	addRow('Original p-value', roundValueAuto(d.original_p_value))
	addRow('Adjusted p-value', roundValueAuto(d.adjusted_p_value))
}

/** Populate a click menu with actions available for a data point. */
export function addClickMenuActions(
	d: DataPointEntry,
	menuDiv: any,
	clickTip: Menu,
	interactions: VolcanoInteractions,
	termType: string
) {
	const addOption = (label: string, handler: () => any) => {
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.text(label)
			.on('click', async () => {
				clickTip.hide()
				await handler()
			})
	}

	if (termType === DNA_METHYLATION) {
		const dm = d as any
		addOption('Violin plot', () => interactions.launchViolin(dm))
		addOption('DMR analysis', () =>
			interactions.launchDmr({
				chr: dm.chr,
				start: dm.start,
				stop: dm.stop,
				promoterId: dm.promoter_id
			})
		)
	} else {
		addOption('Violin plot', () => interactions.launchViolinGeneExp(d.gene_name))
		addOption('Box plot', () => interactions.launchBoxPlot(d.gene_name))
	}
}
