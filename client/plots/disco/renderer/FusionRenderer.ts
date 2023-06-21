import * as d3 from 'd3'
import FullArcRenderer from './FullArcRenderer'
import Fusion from '#plots/disco/viewmodel/Fusion'
import MenuProvider from './MenuProvider'
import { FusionLegend } from '#plots/disco/viewmodel/FusionLegend'

// TODO extract constants from this file.
export default class FusionRenderer {
	private fullArcRenderer: FullArcRenderer

	constructor() {
		this.fullArcRenderer = new FullArcRenderer(80, 2, '#6464641A')
	}

	render(holder: any, fusions: Array<Fusion>) {
		if (fusions.length) {
			this.fullArcRenderer.render(holder)
		}

		const ribboon = d3.ribbon().radius(80)

		const ribbons = holder.selectAll('.chord').data(fusions)

		const menu = MenuProvider.create()

		ribbons
			.enter()
			.append('path')
			.attr('class', 'chord')
			.attr('d', ribboon)
			.attr('fill', (fusion: Fusion) => {
				return this.getColor(fusion)
			})
			.on('mouseover', (mouseEvent: MouseEvent, fusion: Fusion) => {
				menu.d.style('color', '#000').html(this.getTooltip(fusion))
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.hide()
			})
	}

	getColor(fusion: Fusion) {
		const chromosomeSet: Set<string> = new Set()
		chromosomeSet.add(fusion.source.positionInChromosome.chromosome)
		chromosomeSet.add(fusion.target.positionInChromosome.chromosome)
		return chromosomeSet.size < 2 ? FusionLegend.Intrachromosomal.valueOf() : FusionLegend.Interchromosomal.valueOf()
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
