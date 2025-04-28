import * as d3 from 'd3'
import type Arc from './Arc.ts'

export default class FullArcRenderer {
	private radius: number
	private width: number
	private color: string
	constructor(radius: number, width: number, color: string) {
		this.radius = radius
		this.width = width
		this.color = color
	}
	render(holder: any) {
		const donutGenerator = d3.arc<Arc>()
		const arc: Arc = {
			startAngle: 0,
			endAngle: Math.PI * 2,
			innerRadius: this.radius,
			outerRadius: this.radius + this.width,
			color: this.color,
			text: 'No label'
		}

		const array: Array<Arc> = []
		array.push(arc)
		const donutArc = holder.append('g')
		donutArc
			.selectAll('path')
			.data(array)
			.enter()
			.append('path')
			.attr('d', (d: Arc) => donutGenerator(d))
			.attr('fill', (d: Arc) => d.color)
	}
}
