import * as d3 from 'd3'
import LohArc from './LohArc.ts'
import IRenderer from '#plots/disco/IRenderer.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { dtloh } from '@sjcrh/proteinpaint-server/shared/common.js'
import { table2col } from '#dom/table2col'

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
				const table = table2col({ holder: menu.d })
				const loh: any = structuredClone(arc)
				loh.dt = dtloh
				loh.gene = loh.text
				{
					const [td1, td2] = table.addRow()
					td1.text('Data type')
					td2.append('span').style('margin-left', '5px').text('Loss of Heterozygosity')
				}

				const [td1, td2] = table.addRow()
				td1.text('Position')
				td2.append('span').text(`${arc.chr}:${arc.start}-${arc.stop}`)

				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}
}
