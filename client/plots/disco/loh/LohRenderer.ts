import * as d3 from 'd3'
import LohArc from './LohArc.ts'
import IRenderer from '#plots/disco/IRenderer.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'

export default class LohRenderer implements IRenderer {
	render(holder: any, elements: Array<LohArc>) {
		const arcGenerator = d3.arc<LohArc>()

		const arcs = holder.append('g')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			.attr('d', (d: LohArc) => arcGenerator(d))
			.attr('fill', (d: LohArc) => d.color)
			.on('mouseover', (mouseEvent: MouseEvent, arc: LohArc) => {
				menu.d.style('padding', '2px').html(`Loss of Heterozygosity  <br /> ${arc.chr}:${arc.start}-${arc.stop}`)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.hide()
			})
	}
}
