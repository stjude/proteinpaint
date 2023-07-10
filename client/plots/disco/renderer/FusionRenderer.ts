import * as d3 from 'd3'
import FullArcRenderer from './FullArcRenderer'
import Fusion from '../viewmodel/Fusion'
import MenuProvider from './MenuProvider'
import { FusionLegend } from '../viewmodel/FusionLegend'
import FusionColorProvider from '#plots/disco/renderer/FusionColorProvider.ts'

// TODO extract constants from this file.
export default class FusionRenderer {
	render(holder: any, fusions: Array<Fusion>) {
		let radius = 0
		if (fusions.length > 0) {
			radius = fusions[0].target.radius
			const fullArcRenderer = new FullArcRenderer(radius, 2, '#6464641A')
			fullArcRenderer.render(holder)
		}

		const ribboon = d3.ribbon().radius(radius)

		const ribbons = holder.selectAll('.chord').data(fusions)

		const menu = MenuProvider.create()

		ribbons
			.enter()
			.append('path')
			.attr('class', 'chord')
			.attr('d', ribboon)
			.attr('fill', (fusion: Fusion) => {
				return FusionColorProvider.getColor(
					fusion.source.positionInChromosome.chromosome,
					fusion.target.positionInChromosome.chromosome
				)
			})
			.on('mouseover', (mouseEvent: MouseEvent, fusion: Fusion) => {
				menu.d.style('padding', '2px').html(this.getTooltip(fusion))
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.hide()
			})
	}

	getTooltip(fusion: Fusion) {
		let toolTip = ''
		if (fusion.source.gene) {
			toolTip += `${fusion.source.gene}<br />`
		} else {
			const positionInChromosome = fusion.source.positionInChromosome
			toolTip += `${positionInChromosome.chromosome}:${positionInChromosome.position}<br />`
		}

		if (fusion.target.gene) {
			toolTip += fusion.target.gene
		} else {
			const positionInChromosome = fusion.target.positionInChromosome
			toolTip += `${positionInChromosome.chromosome}:${positionInChromosome.position}`
		}

		return toolTip
	}
}
