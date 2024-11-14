export default function getMaxLabelLgth(boxplots, plots) {
	let maxLabelLgth = 0
	for (const p of plots) {
		const label = boxplots.append('text').text(p.boxplot.label)
		maxLabelLgth = Math.max(maxLabelLgth, label.node().getBBox().width)
		label.remove()
	}
	return maxLabelLgth
}
