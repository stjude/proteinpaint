import * as d3 from 'd3'
import type IRenderer from '#plots/disco/IRenderer.ts'
import type Chromosome from './Chromosome.ts'
import MenuProvider from '#plots/disco/menu/MenuProvider.ts'

export default class ChromosomesRenderer implements IRenderer {
	private padAngle: number
	private innerRadius: number
	private outerRadius: number

	constructor(padAngle: number, innerRadius: number, outerRadius: number) {
		this.padAngle = padAngle
		this.innerRadius = innerRadius
		this.outerRadius = outerRadius
	}

	render(holder: any, elements: Array<Chromosome>) {
		const pie = d3
			.pie<Chromosome>()
			.padAngle(this.padAngle)
			.value(d => d.size)
			.sort(null)

		const arcData = pie(elements)

		const arc = d3.arc<d3.PieArcDatum<number>>().innerRadius(this.innerRadius).outerRadius(this.outerRadius)

		const arcs = holder.append('g').attr('data-testid', 'sjpp_chromosomes_arc_group')

		const menu = MenuProvider.create()

		arcs
			.selectAll('path')
			.data(arcData)
			.enter()
			.append('path')
			.attr('d', arc)
			.attr('fill', 'black')
			.on('mousemove', (event: MouseEvent, d: d3.PieArcDatum<Chromosome>) => {
				const [x, y] = d3.pointer(event, arcs.node())
				let angle = Math.atan2(y, x) + Math.PI / 2
				if (angle < 0) angle += 2 * Math.PI
				const frac = Math.max(0, Math.min(1, (angle - d.data.startAngle) / (d.data.endAngle - d.data.startAngle)))
				const pos = Math.round(d.data.start + frac * d.data.size)
				menu.d.text(`Chr ${d.data.text}: Position: ${pos.toLocaleString()}`)
				menu.show(event.x, event.y)
			})
			.on('mouseover', event => {
				d3.select(event.currentTarget as SVGElement)
					.attr('stroke', 'orange')
					.attr('stroke-width', 1)
			})
			.on('mouseout', event => {
				d3.select(event.currentTarget as SVGElement)
					.attr('stroke', null)
					.attr('stroke-width', null)
				menu.hide()
			})

		arcs
			.selectAll('text')
			.data(arcData)
			.enter()
			.append('text')
			// TODO extract all value and functions to Chromosomes
			.attr('transform', (d: d3.PieArcDatum<Chromosome>) => {
				return `translate(${arc.centroid(<any>d)}) rotate(${(d.data.angle * 180) / Math.PI - 90})${
					d.data.angle > Math.PI ? 'rotate(180)' : ''
				}`
			})
			.attr('dy', '0.35em')
			.attr('text-anchor', 'middle')
			.text((d: d3.PieArcDatum<Chromosome>) => d.data.text)
			.style('fill', 'white')
			//prevents chromosome number from interfering with hover
			.style('pointer-events', 'none')
	}
}
