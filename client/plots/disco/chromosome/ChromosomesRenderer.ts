import * as d3 from 'd3'
import type IRenderer from '#plots/disco/IRenderer.ts'
import type Chromosome from './Chromosome.ts'

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

		arcs.selectAll('path').data(arcData).enter().append('path').attr('d', arc).attr('fill', 'black')

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
	}
}
