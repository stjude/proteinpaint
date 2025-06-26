import type CnvArc from '#plots/disco/cnv/CnvArc.ts'
import * as d3 from 'd3'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { table2col } from '#dom/table2col'
import { scaleLinear } from 'd3-scale'
import { dtcnv } from '#shared/common.js'

export class CnvHeatmapRenderer {
	private positivePercentile: number
	private negativePercentile: number

	constructor(positivePercentile = 0, negativePercentile = 0) {
		this.positivePercentile = positivePercentile
		this.negativePercentile = negativePercentile
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
			.attr('fill', (d: CnvArc) => this.getColor(d.color, d.value))
			.on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
				const table = table2col({ holder: menu.d })
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

				{
					const [c1, c2] = table.addRow()
					c1.text('Copy number change')
					//Match the color shown in the tooltip to the heatmap
					c2.html(
						`<span style="background:${this.getColor(
							cnv.color,
							cnv.value
						)}; border:solid lightgrey 0.1px;">&nbsp;&nbsp;</span> ${cnv.value}`
					)
				}
				{
					const [c1, c2] = table.addRow()
					c1.text('Position')
					c2.text(cnv.chr + ':' + cnv.start + '-' + cnv.stop)
				}

				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}

	getColor(color: string, value: number) {
		//For cnv values, use a zero-centered symmetric scale rather than the absolute values
		const maxValue = Math.max(this.positivePercentile, Math.abs(this.negativePercentile))
		return scaleLinear([-maxValue, 0, maxValue], [color, 'white', color]).clamp(true)(value)
	}
}
