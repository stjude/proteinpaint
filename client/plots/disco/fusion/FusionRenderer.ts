import * as d3 from 'd3'
import FullArcRenderer from '#plots/disco/arc/FullArcRenderer.ts'
import Fusion from './Fusion.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import FusionColorProvider from '#plots/disco/fusion/FusionColorProvider.ts'

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
			toolTip += fusion.source.gene
		}
		const positionInChromosomeSource = fusion.source.positionInChromosome
		toolTip += ` ${positionInChromosomeSource.chromosome}:${positionInChromosomeSource.position}<br />`

		if (fusion.target.gene) {
			toolTip += fusion.target.gene
		}
		const positionInChromosomeTarget = fusion.target.positionInChromosome
		toolTip += ` ${positionInChromosomeTarget.chromosome}:${positionInChromosomeTarget.position}`

		return toolTip
	}
}
