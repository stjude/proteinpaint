import IRenderer from '#plots/disco/IRenderer'
import { select } from 'd3-selection'
import { line } from 'd3-shape'
import Label from './Label'
import MenuProvider from '#plots/disco/menu/MenuProvider'
import MutationTooltip from '#plots/disco/label/MutationTooltip'
import FusionTooltip from '#plots/disco/fusion/FusionTooltip'

export default class LabelsRenderer implements IRenderer {
	private animationDuration: number
	private geneClickListener: (gene: string, mnames: Array<string>) => void

	constructor(animationDuration: number, geneClickListener: (gene: string, mnames: Array<string>) => void) {
		this.animationDuration = animationDuration
		this.geneClickListener = geneClickListener
	}

	render(holder: any, elements: Array<Label>, collisions?: Array<Label>) {
		const labelsG = holder.append('g')

		const lineFunction = line<{ x: number; y: number }>()
			.x(point => point.x)
			.y(point => point.y)

		const menu = MenuProvider.create()

		labelsG
			.selectAll('.group')
			.data(elements)
			.enter()
			.append('g')
			.attr('class', 'group')
			.each((label: Label, i: number, nodes: HTMLDivElement[]) => {
				const g = select(nodes[i])
				g.append('text')
					.attr('class', 'chord-text')
					.attr('dy', '.35em')
					.attr('transform', label.transform)
					.style('text-anchor', label.textAnchor)
					.style('font-size', '12px')
					.style('fill', label.color)
					.style('cursor', 'pointer')
					.text(label.text)
					.on('click', () => {
						if (label.mutationsTooltip) {
							this.geneClickListener(
								label.text,
								label.mutationsTooltip.map(value => value.mname)
							)
						}
					})
					.on('mouseover', (mouseEvent: MouseEvent) => {
						menu.d.style('padding', '2px').html(this.createTooltipHtml(label))
						menu.show(mouseEvent.x, mouseEvent.y)
					})
					.on('mouseout', () => {
						menu.hide()
					})

				g.append('path')
					.attr('class', 'chord-tick')
					.datum(label.line.points)
					.style('stroke', label.color)
					.style('fill', 'none')
					.attr('d', lineFunction)
			})

		labelsG.selectAll('.group').each((label: Label, i: number, nodes: HTMLDivElement[]) => {
			const collision = collisions ? collisions.find(l => l.text === label.text) : undefined
			if (collision) {
				const g = select(nodes[i])
				g.selectAll('.chord-text')
					.datum(collision)
					.transition()
					.duration(this.animationDuration)
					.attr('transform', collision.transform)
					.style('text-anchor', collision.textAnchor)

				g.selectAll('.chord-tick')
					.datum(collision.line.points)
					.transition()
					.duration(this.animationDuration)
					.style('fill', 'none')
					.attr('d', lineFunction)
			}
		})
	}

	createTooltipHtml(label: Label) {
		let tooltipHtml = ''

		if (label.mutationsTooltip) {
			tooltipHtml += `Gene: ${label.text} <br />`
			label.mutationsTooltip.forEach((mutation: MutationTooltip) => {
				tooltipHtml += `Consequence: ${mutation.mname} <span style="color: ${mutation.color}" >${mutation.dataClass}</span> <br />Mutation: ${mutation.chr}:${mutation.position} <br />`
			})
		}

		if (label.fusionTooltip) {
			tooltipHtml += `Data type: Fusion transcript <br />`
			label.fusionTooltip.forEach((fusionTooltip: FusionTooltip) => {
				tooltipHtml +=
					`Break points: ${fusionTooltip.geneA ? fusionTooltip.geneA : ''} ${fusionTooltip.chrA}:${
						fusionTooltip.posA
					} ${fusionTooltip.strandA == '+' ? 'forward' : 'reverse'} > ` +
					`${fusionTooltip.geneB ? fusionTooltip.geneB : ''} ${fusionTooltip.chrB}:${fusionTooltip.posB} ${
						fusionTooltip.strandB == '+' ? 'forward' : 'reverse'
					} <br /> `
			})
		}

		return tooltipHtml
	}
}
