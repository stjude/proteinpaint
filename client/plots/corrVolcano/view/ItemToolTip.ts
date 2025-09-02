import { table2col } from '#dom'
import { roundValue } from '#shared/roundValue.js'
import type { Menu } from '#dom'
import type { SvgCircle } from '../../../types/d3'
import type { CorrVolcanoSettings, VariableItem } from '../CorrelationVolcanoTypes'

export class ItemToolTip {
	constructor(item: VariableItem, circle: SvgCircle, tip: Menu, settings: CorrVolcanoSettings) {
		circle.on('mouseover', () => {
			tip.clear().showunder(circle.node())
			const table = table2col({ holder: tip.d.append('table') })
			table.addRow('Item', item.label)
			table.addRow('Correlation (ρ)', roundValue(item.correlation, 3))
			const pValue = settings.isAdjustedPValue ? item.adjusted_pvalue : item.original_pvalue
			table.addRow(settings.isAdjustedPValue ? 'Adjusted p value' : 'Original p value', roundValue(pValue, 5))
			table.addRow('Sample size', item.sampleSize)
		})
		circle.on('mouseout', () => {
			tip.hide()
		})
	}
}
