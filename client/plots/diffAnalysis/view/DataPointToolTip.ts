import { table2col } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'
import type { Menu } from '#dom'
import type { SvgCircle } from '../../../types/d3'
import type { DataPointEntry } from '../DiffAnalysisTypes'
import { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'

export class DataPointToolTip {
	constructor(d: DataPointEntry, circle: SvgCircle, tip: Menu, interactions: DiffAnalysisInteractions) {
		circle.on('mouseover', () => {
			//Show highlight and tooltip on hover
			circle.attr('fill-opacity', 0.9)

			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })
			this.addLine(table, 'Gene name', d.gene_name)
			this.addLine(table, 'Gene symbol', d.gene_symbol)
			this.addLine(table, 'Log2 fold change', d.fold_change)
			this.addLine(table, 'Original p value (log)', roundValueAuto(d.original_p_value))
			this.addLine(table, 'Adjusted p value(log)', roundValueAuto(d.adjusted_p_value))
		})
		circle.on('mouseout', () => {
			// Remove highlight and tooltip on mouseout
			circle.attr('fill-opacity', 0)
			tip.hide()
		})
		circle.on('click', async () => {
			await interactions.launchBoxPlot(d.gene_symbol)
		})
	}

	addLine(table: any, text: string, value: number | string) {
		const [td1, td2] = table.addRow()
		td1.html(text)
		td2.text(value)
	}
}
