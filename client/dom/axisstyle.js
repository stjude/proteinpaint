export function axisstyle(p) {
	if (!p || !p.axis) return
	if (!p.color) {
		p.color = '#545454'
	}
	p.axis.selectAll('line').attr('stroke', p.color).attr('shape-rendering', 'crispEdges')
	p.axis
		.selectAll('path')
		.attr('fill', 'none')
		.attr('stroke', p.showline ? p.color : 'none')
		.attr('stroke-width', p.showline ? 1 : 0)
		.attr('shape-rendering', 'crispEdges')
	p.axis
		.selectAll('text')
		.style('cursor', 'default')
		.attr('font-size', p.fontsize ? p.fontsize + 'px' : '12px')
		.attr('fill', p.color)
}
