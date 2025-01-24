import { table2col } from '#dom'
import { roundValue } from '#shared/roundValue.js'
import type { Menu } from '#dom'
import type { SvgCircle } from '../../../types/d3'
import type { CorrVolcanoSettings } from '../CorrelationVolcanoTypes'

export class ItemToolTip {
	constructor(item: any, circle: SvgCircle, tip: Menu, settings: CorrVolcanoSettings) {
		circle.on('mouseover', () => {
			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })
			//Header
			const [th, _] = table.addRow()
			th.attr('colspan', '2').style('text-align', 'center').text(item.label)
			//Show correlation
			this.addLine(table, 'Correlation (&#961;)', item.correlation)
			//Show p value
			const pValueText = settings.isAdjustedPValue ? 'Adjusted p value' : 'Original p value'
			const pValue = settings.isAdjustedPValue ? item.adjusted_pvalue : item.original_pvalue
			this.addLine(table, pValueText, roundValue(pValue, 5))
			//Show sample size
			this.addLine(table, 'Sample size', item.sampleSize)
		})
		circle.on('mouseout', () => {
			tip.hide()
		})
	}

	addLine(table: any, text: string, value: number) {
		const [td1, td2] = table.addRow()
		td1.html(text)
		td2.text(value)
	}
}
