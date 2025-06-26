import * as d3 from 'd3'
import type IRenderer from '#plots/disco/IRenderer.ts'
import type CnvArc from './CnvArc.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'

export default class CnvRenderer implements IRenderer {
	private menuPadding: number

	constructor(menuPadding: number) {
		this.menuPadding = menuPadding
	}

	render(holder: any, elements: Array<CnvArc>) {
		const arcGenerator = d3.arc<CnvArc>()

		const arcs = holder.append('g')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			.attr('d', (d: CnvArc) => arcGenerator(d))
			.attr('fill', (d: CnvArc) => d.color)
			.on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
				menu.d
					.style('padding', '2px')
					.html(`Copy Number Variation <br /> ${arc.chr}:${arc.start}-${arc.stop} <br /> ${arc.unit}: ${arc.value}  `)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.hide()
			})
	}
}
