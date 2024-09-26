import * as d3 from 'd3'
import IRenderer from '#plots/disco/IRenderer.ts'
import CnvArc from './CnvArc.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { dtcnv } from '#shared/common.js'
import { table2col } from '#dom/table2col'

export default class CnvBarRenderer implements IRenderer {
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
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

				const table = table2col({ holder: menu.d })
				{
					const [c1, c2] = table.addRow()
					c1.text('Copy number change')
					c2.html(`<span style="background:${cnv.color}">&nbsp;&nbsp;</span> ${cnv.value}`)
				}
				{
					const [c1, c2] = table.addRow()
					c1.text('Position')
					c2.text(cnv.chr + ':' + cnv.start + '-' + cnv.stop)
				}
				{
					const [c1, c2] = table.addRow()
					c1.text('Unit')
					c2.text(cnv.value)
				}

				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}
}
