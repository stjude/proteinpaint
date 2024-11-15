import type { LegendData, LegendItemEntry } from '../viewModel/LegendDataMapper'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import type { Div } from '../../../types/d3'
import { rgb } from 'd3-color'

export class LegendRenderer {
	interactions: BoxPlotInteractions
	constructor(legendDiv: Div, legendData: LegendData, interactions: BoxPlotInteractions) {
		this.interactions = interactions
		this.renderLegend(legendDiv, legendData)
	}

	renderLegend(legendDiv, legendData: LegendData) {
		legendDiv.attr('id', 'sjpp-boxplot-legend')
		for (const section of legendData) {
			legendDiv.append('div').style('opacity', '0.5').text(section.label)
			const sectionDiv = legendDiv.append('div').style('padding-left', '10px')
			for (const item of section.items) {
				this.addItem(item, sectionDiv)
			}
		}
	}

	addItem(item: LegendItemEntry, sectionDiv) {
		const legendItem = sectionDiv.append('div')
		if (item.color) {
			legendItem
				.append('div')
				.style('display', 'inline-block')
				.style('min-width', '12px')
				.style('height', '12px')
				.style('background-color', item.color)
				.style('border', `1px solid ${rgb(item.color).darker(1)}`)
				.style('margin-right', '3px')
				.style('top', '1px')
				.style('position', 'relative')
		}
		legendItem
			.append('div')
			.style('display', 'inline-block')
			.style('text-decoration', item.isHidden ? 'line-through' : '')
			.text(`${item.label}${item.value ? `: ${item.value}` : item.count ? `, n=${item.count}` : ''}`)

		if (item.color) {
			//Do not apply to uncomputable values, only items with plot data
			legendItem.attr('aria-label', `Click to unhide plot`).on('click', () => {
				this.interactions.unhidePlot(item)
			})
		}
	}
}
