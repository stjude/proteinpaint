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
			//Show p value
			const [td1, td2] = table.addRow()
			td1.text(`${settings.isAdjustedPValue ? 'Adjusted p-value ' : 'Original p-value'} (-log10)`)
			const value = settings.isAdjustedPValue ? item.adjusted_pvalue : item.original_pvalue
			td2.text(roundValue(value, 5))
			const [td3, td4] = table.addRow()
			//Show correlation
			td3.text('Correlation')
			td4.text(item.correlation)
			//Show sample size
			const [td5, td6] = table.addRow()
			td5.text('Sample size')
			td6.text(item.sampleSize)
		})
		circle.on('mouseout', () => {
			tip.hide()
		})
	}
}
