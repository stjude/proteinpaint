import { mouse, event } from 'd3-selection'

export function getSeriesTip(g, rect, tip) {
	let lineHovered = false
	const line = g
		.insert('line', 'rect')
		.style('display', 'none')
		.style('stroke', '#555')
		.style('stroke-width', '1px')

	const lineNode = line.node()
	const rectNode = rect.node()

	function mouseOver() {
		const m = mouse(rectNode) //; console.log(m)

		line
			.style('display', '')
			.attr('x1', m[0])
			.attr('x2', m[0])

		let hasMatched = false
		serieses.map(s => {
			let matched
			for (const d of s.data) {
				if (d.scaledX < m[0]) matched = d
			}
			if (matched) hasMatched = true
			s.d = {
				x: matched.x,
				y: matched.y,
				lower: 'low' in matched ? matched.low : matched.lower,
				upper: 'high' in matched ? matched.high : matched.upper
			}
		})
		if (hasMatched) {
			const x = serieses[0].xScale.invert(m[0]).toFixed(2)
			const label = serieses[0].seriesLabel ? serieses[0].seriesLabel + ':' : ''
			tip
				.show(event.clientX, event.clientY)
				.d.html(
					`Time: ${x}<br><br>` +
						serieses
							.map(
								d =>
									`<span style='color: ${d.color}'>${label} ${d.d.y}% at previous TTE=${d.d.x}, <br/>(${d.d.lower}, ${d.d.upper})</span>`
							)
							.join('<br><br/>')
				)
		} else {
			tip.hide()
		}
	}

	rect
		.on('mouseover', mouseOver)
		.on('mousemove', mouseOver)
		.on('mouseout', () => {
			line.style('display', 'none')
		})

	let serieses
	return {
		update(_serieses) {
			serieses = _serieses
			const x = rect.attr('x')
			const y = rect.attr('y')
			line
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', y)
				.attr('y2', rect.attr('height') - y)
		}
	}
}
