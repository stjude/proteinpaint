import { mouse, event } from 'd3-selection'
import { Menu } from '#dom/menu'

export function getSeriesTip(g, rect, _tip = null) {
	const tip = _tip || new Menu({ padding: '5px' })
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
			s.d = !matched
				? null
				: {
						x: matched.x.toFixed(2),
						y: matched.y.toFixed(2),
						lower: ('low' in matched ? matched.low : matched.lower).toFixed(2),
						upper: ('high' in matched ? matched.high : matched.upper).toFixed(2)
				  }
		})
		if (hasMatched) {
			const x = serieses[0].xScale.invert(m[0]).toFixed(2)
			tip.show(event.clientX, event.clientY).d.html(
				`Time: ${x}<br><br>` +
					serieses
						.filter(d => d.d)
						.map(
							d =>
								`<span style='color: ${d.color}'>${d.seriesLabel ? d.seriesLabel + ':' : ''} ${
									d.d.y
								}% at previous TTE=${d.d.x}, <br/>(${d.d.lower} to ${d.d.upper})</span>`
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
