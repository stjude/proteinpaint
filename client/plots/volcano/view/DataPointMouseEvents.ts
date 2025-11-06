import { table2col, type Menu } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { SvgCircle } from '../../../types/d3'
import type { VolcanoInteractions } from '../interactions/VolcanoInteractions'
import type { DataPointEntry } from '../VolcanoTypes'
// import { TermTypes } from '#shared/terms.js'

export class DataPointMouseEvents {
	termType: string
	constructor(d: DataPointEntry, circle: SvgCircle, tip: Menu, interactions: VolcanoInteractions, termType: string) {
		this.termType = termType
		circle.on('mouseover', () => {
			//Show highlight and tooltip on hover
			circle.attr('fill-opacity', 0.9)

			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })

			this.mayAddGeneExpressionRows(d, table)
		})

		circle.on('mouseout', () => {
			tip.hide()
			if (d.highlighted) return
			// Remove highlight and tooltip on mouseout
			circle.attr('fill-opacity', 0)
		})
		circle.on('click', async () => {
			await interactions.launchBoxPlot(d.gene_name)
		})
	}

	addTooltipRow(table: any, text: string, value: number | string) {
		const [td1, td2] = table.addRow()
		td1.html(text)
		td2.text(value)
	}

	mayAddGeneExpressionRows(d: DataPointEntry, table: any) {
		// if (this.termType !== TermTypes.GENE_EXPRESSION) return
		this.addTooltipRow(table, 'Gene name', d.gene_name)
		this.addTooltipRow(table, 'log2(fold change)', roundValueAuto(d.fold_change))
		this.addTooltipRow(table, 'Original p value', roundValueAuto(d.original_p_value))
		this.addTooltipRow(table, 'Adjusted p value', roundValueAuto(d.adjusted_p_value))
	}
}
