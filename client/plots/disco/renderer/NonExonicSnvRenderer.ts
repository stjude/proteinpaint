import IRenderer from './IRenderer'
import * as d3 from 'd3'
import SnvArc from '#plots/disco/viewmodel/SnvArc'
import Arc from '#plots/disco/viewmodel/Arc'
import MenuProvider from './MenuProvider'

export default class NonExonicSnvRenderer implements IRenderer {
	render(holder: any, elements: Array<Arc>) {
		const arcGenerator = d3.arc<SnvArc>()

		const arcs = holder.append('g')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			.attr('d', (d: SnvArc) => arcGenerator(d))
			.attr('fill', (d: SnvArc) => d.color)
			.on('mouseover', (mouseEvent: MouseEvent, arc: SnvArc) => {
				menu.d
					.style('padding', '2px')
					.html(
						`Gene: ${arc.text} <br />${arc.mname} <br /> <span style="color:${arc.color}">${arc.dataClass}</span> <br /> ${arc.chr}:${arc.pos}`
					)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.hide()
			})
	}
}
