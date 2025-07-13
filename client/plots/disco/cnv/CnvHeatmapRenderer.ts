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

		// Group for actual heatmap CNV arcs
		const arcs = holder.append('g')

		// Separate group for overlays on hover (not blocking interactions)
		const hoverOverlay = holder.append('g').attr('class', 'hover-overlay').style('pointer-events', 'none')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			// Generate the arc shape for each CNV
			.attr('d', (d: CnvArc) => arcGenerator(d))
			// Fill using interpolated color based on CNV value and percentile range
			.attr('fill', (d: CnvArc) => this.getColor(d.color, d.value))

			// Hover event: show highlight stroke and tooltip
			.on('mouseenter', (mouseEvent: MouseEvent, arc: CnvArc) => {
				// Add highlight stroke over the hovered arc
				hoverOverlay
					.append('path')
					.datum(arc)
					.attr('d', arcGenerator(arc))
					.attr('fill', 'none')
					.attr('stroke', 'black')
					.attr('stroke-width', 1)

				// Prepare data for tooltip
				const table = table2col({ holder: menu.d })
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

				// Row 1: Copy number change + colored square
				{
					const [c1, c2] = table.addRow()
					c1.text('CNV')
					//Match the color shown in the tooltip to the heatmap
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

			// Cleanup on hover out: remove highlight and hide tooltip
			.on('mouseleave', () => {
				hoverOverlay.selectAll('*').remove()
				menu.clear()
				menu.hide()
			})
	}

	// Computes fill color using linear scale between -P80, 0, and +P80
	getColor(color: string, value: number) {
		//For cnv values, use a zero-centered symmetric scale rather than the absolute values
		const maxValue = Math.max(this.positivePercentile, Math.abs(this.negativePercentile))
		return scaleLinear(
			[-maxValue, 0, maxValue],
			[color, 'white', color] // transitions to white in the middle
		).clamp(true)(value)
	}
}
