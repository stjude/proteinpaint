import { table2col, type Menu } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { SvgCircle } from '../../../types/d3'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { DataPointEntry } from '../VolcanoTypes'
import { DNA_METHYLATION } from '#shared/terms.js'

export class DataPointMouseEvents {
	termType: string
	constructor(d: DataPointEntry, circle: SvgCircle, tip: Menu, interactions: VolcanoInteractions, termType: string) {
		this.termType = termType
		circle.on('mouseover', () => {
			//Show highlight and tooltip on hover
			circle.attr('fill-opacity', 0.9)

			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })

			this.addTooltipRows(d, table)
		})

		let menuOpen = false
		circle.on('mouseout', () => {
			if (menuOpen) return
			tip.hide()
			if (d.highlighted) return
			circle.attr('fill-opacity', 0)
		})
		circle.on('click', () => {
			menuOpen = true
			tip.onHide = () => {
				menuOpen = false
				if (!d.highlighted) circle.attr('fill-opacity', 0)
			}
			tip.clear().showunder(circle.node())
			const menuDiv = tip.d.append('div').style('padding', '5px')

			if (termType === DNA_METHYLATION) {
				const dm = d as any
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('Violin plot')
					.on('click', () => {
						tip.hide()
						interactions.launchViolin(dm)
					})
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('DMR analysis')
					.on('click', async () => {
						tip.hide()
						await interactions.launchDmr({
							chr: dm.chr,
							start: dm.start,
							stop: dm.stop,
							promoterId: dm.promoter_id
						})
					})
			} else {
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('Violin plot')
					.on('click', async () => {
						tip.hide()
						await interactions.launchViolinGeneExp(d.gene_name)
					})
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('Box plot')
					.on('click', async () => {
						tip.hide()
						await interactions.launchBoxPlot(d.gene_name)
					})
			}
		})
	}

	addTooltipRow(table: any, text: string, value: number | string) {
		const [td1, td2] = table.addRow()
		td1.html(text)
		td2.text(value)
	}

	addTooltipRows(d: DataPointEntry, table: any) {
		if (this.termType === DNA_METHYLATION) {
			if ('promoter_id' in d) this.addTooltipRow(table, 'Promoter', d.promoter_id)
			if (d.gene_name) this.addTooltipRow(table, 'Gene(s)', d.gene_name)
		} else {
			this.addTooltipRow(table, 'Gene name', d.gene_name)
		}
		this.addTooltipRow(table, 'log<sub>2</sub>(fold-change)', roundValueAuto(d.fold_change))
		this.addTooltipRow(table, 'Original p-value', roundValueAuto(d.original_p_value))
		this.addTooltipRow(table, 'Adjusted p-value', roundValueAuto(d.adjusted_p_value))
	}
}
