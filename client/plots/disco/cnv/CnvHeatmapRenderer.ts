import CnvArc from '#plots/disco/cnv/CnvArc.ts'
import * as d3 from 'd3'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { table2col } from '#dom/table2col'
import { scaleLinear } from 'd3-scale'
import { dtcnv } from '#shared/common.js'

export class CnvHeatmapRenderer {
	private positivePercentile80: number
	private negativePercentile80: number

	constructor(positivePercentile80 = 0, negativePercentile80 = 0) {
		this.positivePercentile80 = positivePercentile80
		this.negativePercentile80 = negativePercentile80
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
			.attr('fill', (d: CnvArc) =>
				scaleLinear([this.negativePercentile80, 0, this.positivePercentile80], [d.color, 'white', d.color]).clamp(true)(
					d.value
				)
			)
			.on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
				const table = table2col({ holder: menu.d })
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

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
