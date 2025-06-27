import type CnvArc from '#plots/disco/cnv/CnvArc.ts'
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

		// Group for actual heatmap CNV arcs
		const arcs = holder.append('g')
		const hoverOverlay = holder.append('g')
			.attr('class', 'hover-overlay')
			.style('pointer-events', 'none')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			// Generate arc shape for each CNV
			.attr('d', (d: CnvArc) => arcGenerator(d))
			// Fill using interpolated color based on CNV value and percentile range
			.attr('fill', (d: CnvArc) => this.getColor(d.color, d.value))

			// Hover event: show highlight stroke and tooltip
			.on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
				hoverOverlay.append('path')
					.datum(arc)
					.attr('d', arcGenerator(arc))
					.attr('fill', 'none')
					.attr('stroke', 'black')
					.attr('stroke-width', 1)

				const table = table2col({ holder: menu.d })
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

				// Row 1: Copy number change + colored square
				{
					const [c1, c2] = table.addRow()
					c1.text('Copy number change')
					c2.html(
						`<span style="background:${this.getColor(
							cnv.color,
							cnv.value
						)}; border:solid lightgrey 0.1px;">&nbsp;&nbsp;</span> ${cnv.value}`
					)
				}
				// Row 2: Position
				{
					const [c1, c2] = table.addRow()
					c1.text('Position')
					c2.text(cnv.chr + ':' + cnv.start + '-' + cnv.stop)
				}

				// Show tooltip near mouse
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', (event) => {
				hoverOverlay.selectAll('*').remove()
				menu.clear()
				menu.hide()
			})
	}

	// Computes fill color using linear scale between -P80, 0, and +P80
	getColor(color: string, value: number) {
		return scaleLinear(
			[this.negativePercentile80, 0, this.positivePercentile80],
			[color, 'white', color]
		).clamp(true)(value)
	}
}
