import * as d3 from 'd3'
import SnvArc from './SnvArc.ts'
import IRenderer from '#plots/disco/IRenderer.ts'
import FullArcRenderer from '#plots/disco/arc/FullArcRenderer.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'
import { dtsnvindel, mclass } from '#shared/common.js'
import { table2col } from '#dom/table2col'

export default class SnvRenderer implements IRenderer {
	private svnWidth: number

	private geneClickListener: (gene: string, mnames: Array<string>) => void

	constructor(svnWidth: number, geneClickListener: (gene: string, mnames: Array<string>) => void) {
		this.svnWidth = svnWidth

		this.geneClickListener = geneClickListener
	}

	render(holder: any, elements: Array<SnvArc>) {
		if (elements.length > 0) {
			const svnInnerRadius = elements[0].innerRadius
			const fullArcRenderer = new FullArcRenderer(svnInnerRadius, this.svnWidth, '#6464641A')
			fullArcRenderer.render(holder)
		}

		const arcGenerator = d3.arc<SnvArc>()

		const arcs = holder.append('g')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(elements)
			.enter()
			.append('path')
			.attr('d', (d: SnvArc) => arcGenerator(d))
			.attr('fill', (d: SnvArc) => d.color)
			.on('mouseover', (mouseEvent: MouseEvent, arc: SnvArc) => {
				const table = table2col({ holder: menu.d })
				const snv: any = structuredClone(arc)
				snv.dt = dtsnvindel
				snv.class = arc.dataClass
				snv.gene = snv.text

				{
					const [td1, td2] = table.addRow()
					td1.text('Consequence')
					td2.append('span').text(snv.mname)
					td2
						.append('span')
						.style('margin-left', '5px')
						.style('color', snv.color)
						.style('font-size', '.8em')
						.text(snv.dataClass)
				}
				{
					const [td1, td2] = table.addRow()
					td1.text(snv.ref && snv.alt ? 'Mutation' : 'Position')
					td2.append('span').text(`${snv.chr}:${snv.pos + 1} ${snv.ref && snv.alt ? snv.ref + '>' + snv.alt : ''}`)
				}

				if (snv.gene) {
					const [td1, td2] = table.addRow()
					td1.text('Gene')
					td2.text(snv.gene)
				}

				if (snv.occurrence > 1) {
					const [td1, td2] = table.addRow()
					td1.text('Occurrence')
					td2.text(snv.occurrence)
				}

				menu.show(mouseEvent.x, mouseEvent.y)
			})
			.on('mouseout', () => {
				menu.clear()
				menu.hide()
			})
			.on('click', (mouseEvent: MouseEvent, arc: SnvArc) => {
				this.geneClickListener(arc.text, [arc.mname])
			})
	}
}
