import * as d3 from 'd3'
import IRenderer from '#plots/disco/IRenderer.ts'
import CnvArc from './CnvArc.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { table2col } from '#dom/table2col'
import { table_cnv } from '../../../mds3/itemtable'
import { ar } from '../../../dist/app-755e3b83'
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
				const table = table2col({ holder: menu.d })
				const cnv: any = structuredClone(arc)
				cnv.samples = [{ sample_id: arc.sampleName }]
				table_cnv({ mlst: [cnv] }, table, () => {
					return arc.color
				})

				// menu.d
				// 	.style('padding', '2px')
				// 	.html(`Copy Number Variation <br /> ${arc.chr}:${arc.start}-${arc.stop} <br /> ${arc.unit}: ${arc.value}  `)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}
}
