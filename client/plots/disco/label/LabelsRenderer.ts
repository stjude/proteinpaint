import type IRenderer from '#plots/disco/IRenderer.ts'
import { select } from 'd3-selection'
import { line } from 'd3-shape'
import type Label from './Label.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import type MutationTooltip from '#plots/disco/label/MutationTooltip.ts'
import type FusionTooltip from '#plots/disco/fusion/FusionTooltip.ts'
import { table2col } from '#dom/table2col'
import type CnvTooltip from '#plots/disco/cnv/CnvTooltip.ts'

export default class LabelsRenderer implements IRenderer {
       private animationDuration: number
       private fontSize: number
       private geneClickListener: (gene: string, mnames: Array<string>) => void

       constructor(
               animationDuration: number,
               fontSize: number,
               geneClickListener: (gene: string, mnames: Array<string>) => void
       ) {
			this.animationDuration = animationDuration
			this.fontSize = fontSize
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
					.style('font-size', `${this.fontSize}px`)
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
						const table = table2col({ holder: menu.d })
						this.createTooltip(table, label)
						menu.show(mouseEvent.x, mouseEvent.y)
					})
					.on('mouseout', () => {
						menu.clear()
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

	createTooltip(table: any, label: Label) {
		if (label.mutationsTooltip) {
			const [td1, td2] = table.addRow()
			td1.text('Gene')
			td2.append('span').style('margin-left', '5px').text(label.text)

			label.mutationsTooltip.forEach((mutation: MutationTooltip) => {
				{
					const [td1, td2] = table.addRow()

					td1.text('Mutation')
					td2
						.append('span')
						.style('margin-left', '5px')
						.text(mutation.mname)
						.append('span')
						.style('margin-left', '5px')
						.style('color', mutation.color)
						.text(`${mutation.dataClass}`)
						.append('span')
						.style('margin-left', '5px')
						.style('color', 'black')
						.style('font-size', '0.8em')
						.text(` ${mutation.chr}:${mutation.position}`)
				}
			})
		}

		if (label.fusionTooltip) {
			const [td1, td2] = table.addRow()

			td1.text('Data type')
			td2.append('span').text('Fusion transcript')
			label.fusionTooltip.forEach((fusionTooltip: FusionTooltip) => {
				const [td1, td2] = table.addRow()

				td1.text('Position')
				td2.append('span').text(
					` ${fusionTooltip.geneA ? fusionTooltip.geneA : '?'} ${fusionTooltip.chrA}:${fusionTooltip.posA}
						${fusionTooltip.strandA == '+' ? 'forward' : 'reverse'} > ` +
						`${fusionTooltip.geneB ? fusionTooltip.geneB : '?'} ${fusionTooltip.chrB}:${fusionTooltip.posB} ${
							fusionTooltip.strandB == '+' ? 'forward' : 'reverse'
						} `
				)
			})
		}

		if (label.cnvTooltip) {
			label.cnvTooltip.forEach((cnv: CnvTooltip) => {
				const [td1, td2] = table.addRow()
				td1.text('CNV')
				td2.append('span').style('margin-left', '5px').style('background-color', cnv.color).html('&nbsp;&nbsp;')

				td2
					.append('span')
					.style('margin-left', '7.5px')
					.text(cnv.value)
					.append('span')
					.style('margin-left', '7.5px')
					.style('font-size', '0.8em')
					.text(`${cnv.chr}:${cnv.start}-${cnv.stop}`)
			})
		}
	}
}
