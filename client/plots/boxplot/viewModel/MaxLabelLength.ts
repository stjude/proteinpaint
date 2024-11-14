export default function getMaxLabelLgth(dom, plots) {
	let maxLabelLgth = 0
	for (const p of plots) {
		const label = dom.boxplots.append('text').text(p.boxplot.label)
		maxLabelLgth = Math.max(maxLabelLgth, label.node().getBBox().width)
		label.remove()
	}
	return maxLabelLgth
}
