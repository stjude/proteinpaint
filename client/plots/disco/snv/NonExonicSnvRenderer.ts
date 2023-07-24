import IRenderer from '../IRenderer'
import * as d3 from 'd3'
import SnvArc from './SnvArc'
import Arc from '../arc/Arc'
import MenuProvider from '../menu/MenuProvider'

export default class NonExonicSnvRenderer implements IRenderer {
	private geneClickListener: (gene: string, mnames: Array<string>) => void

	constructor(geneClickListener: (gene: string, mnames: Array<string>) => void) {
		this.geneClickListener = geneClickListener
	}

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
			.on('click', (mouseEvent: MouseEvent, arc: SnvArc) => {
				this.geneClickListener(arc.text, [arc.mname])
			})
	}
}
