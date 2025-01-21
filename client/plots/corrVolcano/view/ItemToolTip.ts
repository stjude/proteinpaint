import { table2col } from '#dom'

export class ItemToolTip {
	constructor(item, g, tip, settings) {
		g.on('mouseover', () => {
			tip.clear().showunder(g.node())
			const table = table2col({ holder: tip.d.append('table') })
			//Header
			const [th, _] = table.addRow()
			th.attr('colspan', '2').text(item.label)
			//Show p value
			const [td1, td2] = table.addRow()
			td1.text(settings.isAdjustedPValue ? 'Adjusted p-value' : 'Original p-value')
			td2.text(settings.isAdjustedPValue ? item.adjusted_pvalue : item.original_pvalue)
			const [td3, td4] = table.addRow()
			//Show correlation
			td3.text('Correlation')
			td4.text(item.correlation)
			//Show sample size
			const [td5, td6] = table.addRow()
			td5.text('Sample size')
			td6.text(item.sampleSize)
		})
		g.on('mouseout', () => {
			tip.hide()
		})
	}
}
