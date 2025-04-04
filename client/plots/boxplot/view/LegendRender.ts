import type { LegendData, LegendItemEntry } from '../BoxPlotTypes'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import type { Div } from '../../../types/d3'

export class LegendRenderer {
	interactions: BoxPlotInteractions
	textColor: string
	constructor(legendDiv: Div, legendData: LegendData, interactions: BoxPlotInteractions, textColor: string) {
		this.interactions = interactions
		this.textColor = textColor
		this.renderLegend(legendDiv, legendData)
	}

	renderLegend(legendDiv: Div, legendData: LegendData) {
		legendDiv.attr('id', 'sjpp-boxplot-legend')
		for (const section of legendData) {
			legendDiv.append('div').style('opacity', '0.5').style('color', this.textColor).text(section.label)
			const sectionDiv = legendDiv.append('div').style('padding-left', '10px')
			for (const item of section.items) {
				this.addItem(item, sectionDiv)
			}
		}
	}

	addItem(item: LegendItemEntry, sectionDiv: Div) {
		const legendItem = sectionDiv.append('div')
		if (item.isPlot) {
			legendItem
				.append('div')
				.style('display', 'inline-block')
				.style('margin-right', '3px')
				.style('position', 'relative')
				.style('vertical-align', 'middle')
				.html(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${this.textColor}" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16" style="vertical-align: middle; display: block; margin: auto;">
                <path stroke="#000" stroke-width="0.25" fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
                </svg>`)
		}
		legendItem
			.append('div')
			.style('display', 'inline-block')
			.style('color', this.textColor)
			.style('text-decoration', item.isHidden ? 'line-through' : '')
			.text(item.text)

		if (item.isPlot) {
			//Do not apply to uncomputable values, only items with plot data
			legendItem.attr('aria-label', `Click to unhide plot`).on('click', () => {
				this.interactions.unhidePlot(item)
			})
		}
	}
}
