function drawBoxplot({ bp, g, color, scale }) {
	if (bp.label) {
		g.label = g
			.append('text')
			.attr('font-family', 'Arial')
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('class', 'sja_clbtext')
			.text(bp.label)
		bp.label
			.attr('fill', color)
			.attr('font-family', client.font)
			.attr('dominant-baseline', 'central')
	}

	if (bp.w1 != undefined) {
		// has valid values for boxplot, could be missing
		bp.hline = g.g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
		bp.linew1 = g.g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
		bp.linew2 = g.g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
		bp.box = g.g
			.append('rect')
			.attr('fill', 'white')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
		bp.linep50 = g.g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
	}
	// outliers
	for (const d of bp.out) {
		d.circle = g.g
			.append('circle')
			.attr('stroke', color)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.on('mouseover', () => {
				plot.tip
					.clear()
					.d.append('div')
					.style('margin', '10px')
					.html(d.sample + '<br>' + d.value)
				plot.tip.show(d3event.clientX, d3event.clientY)
			})
			.on('mouseout', () => {
				plot.tip.hide()
			})

		if (plot.clicksample) {
			d.circle.on('click', () => {
				plot.clicksample(d, g, plot)
			})
		}
	}
}
