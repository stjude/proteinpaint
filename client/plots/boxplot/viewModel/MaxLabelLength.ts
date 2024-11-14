import type { BoxPlotEntry } from '#types'
import type { SvgG } from '../../../types/d3'

export default function getMaxLabelLgth(boxplots: SvgG, plots: BoxPlotEntry[]) {
	let maxLabelLgth = 0
	for (const p of plots) {
		const label = boxplots.append('text').text(p.boxplot.label)
		maxLabelLgth = Math.max(maxLabelLgth, label.node()!.getBBox().width)
		label.remove()
	}
	return maxLabelLgth
}
