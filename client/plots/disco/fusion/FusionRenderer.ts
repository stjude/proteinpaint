import * as d3 from 'd3'
import FullArcRenderer from '#plots/disco/arc/FullArcRenderer.ts'
import type Fusion from './Fusion.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import FusionColorProvider from '#plots/disco/fusion/FusionColorProvider.ts'
import { table2col } from '#dom/table2col'

// TODO extract constants from this file.
export default class FusionRenderer {
	private opacity: number

	constructor(opacity = 1) {
		this.opacity = opacity
	}

	render(holder: any, fusions: Array<Fusion>, opacityOverride?: number) {
		let radius = 0
		const fusionsWithTarget = fusions.filter(f => f.target)
		if (fusionsWithTarget.length > 0) {
			radius = fusionsWithTarget[0].target.radius
			const fullArcRenderer = new FullArcRenderer(radius, 2, '#6464641A')
			fullArcRenderer.render(holder)
		} else return

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
			.style('opacity', opacityOverride ?? this.opacity)
			.on('mouseover', (mouseEvent: MouseEvent, fusion: Fusion) => {
				const table = table2col({ holder: menu.d })
				this.createTooltip(table, fusion)
				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
	}

	createTooltip(table: any, fusion: Fusion) {
		{
			const [td1, td2] = table.addRow()
			td1.text('Data type')
			td2.append('span').style('margin-left', '5px').text('Fusion transcript')
		}
		{
			const positionInChromosomeSource = fusion.source.positionInChromosome
			const positionInChromosomeTarget = fusion.target.positionInChromosome

			const [td1, td2] = table.addRow()

			td1.text('Position')
			td2
				.append('span')
				.style('margin-left', '5px')
				.text(
					` ${fusion.source.gene ? fusion.source.gene : ''} ${positionInChromosomeSource.chromosome}:${
						positionInChromosomeSource.position
					} ${fusion.source.strand == '+' ? 'forward' : 'reverse'} > ` +
						` ${fusion.target.gene ? fusion.target.gene : ''} ${positionInChromosomeTarget.chromosome}:${
							positionInChromosomeTarget.position
						} ${fusion.target.strand == '+' ? 'forward' : 'reverse'} `
				)
		}
	}
}
