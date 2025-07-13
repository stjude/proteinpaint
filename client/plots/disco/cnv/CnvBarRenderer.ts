import * as d3 from 'd3'
import type IRenderer from '#plots/disco/IRenderer.ts'
import type CnvArc from './CnvArc.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { dtcnv } from '#shared/common.js'
import { table2col } from '#dom/table2col'

export default class CnvBarRenderer implements IRenderer {
	render(holder: any, elements: Array<CnvArc>) {
		const arcGenerator = d3.arc<CnvArc>()

		// Create a group for the arcs (actual CNV bars)
		const arcs = holder.append('g')
		// Create a group for overlays used to highlight hovered bars
		const hoverOverlay = holder
			.append('g')
			.attr('class', 'hover-overlay')
			// prevent highlighht from blocking thin CNVs
			.style('pointer-events', 'none')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			// Generate arc path for each CNV
			.attr('d', (d: CnvArc) => arcGenerator(d))
			// Fill with the CNV's specified color
			.attr('fill', (d: CnvArc) => d.color)
			// Start of highlight + tooltip behavior
			.on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
				// Remove any existing overlay (e.g., from previous hover)
				hoverOverlay.selectAll('*').remove()
				// Add a highlighted black stroke on top of the hovered arc
				hoverOverlay
					.append('path')
					.datum(arc)
					.attr('d', arcGenerator(arc))
					.attr('fill', 'none')
					.attr('stroke', 'black')
					.attr('stroke-width', 1)

				// Prepare the CNV data for tooltip display
				const cnv: any = structuredClone(arc)
				cnv.dt = dtcnv
				cnv.samples = [{ sample_id: arc.sampleName }]
				cnv.gene = cnv.text

				// Create a two-column table in the tooltip
				const table = table2col({ holder: menu.d })
				// Add: Copy number change row
				{
					const [c1, c2] = table.addRow()
					c1.text('CNV')
					c2.html(`<span style="background:${cnv.color}">&nbsp;&nbsp;</span> ${cnv.value}`)
				}
				// Add: Position row
				{
					const [c1, c2] = table.addRow()
					c1.text('Position')
					c2.text(cnv.chr + ':' + cnv.start + '-' + cnv.stop)
				}
				// Add: Unit value row
				{
					const [c1, c2] = table.addRow()
					c1.text('Unit')
					c2.text(cnv.value)
				}

				// Show tooltip near the cursor
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			// Remove highlight and tooltip when mouse leaves
			.on('mouseout', () => {
				hoverOverlay.selectAll('*').remove()
				menu.clear()
				menu.hide()
			})
	}
}
