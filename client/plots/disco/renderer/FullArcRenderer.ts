import * as d3 from 'd3'
import Arc from '../viewmodel/Arc'

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
		const arc = new Arc(
			0,
			Math.PI * 2,
			this.radius,
			this.radius + this.width,
			// TODO extract color
			'#6464641A',
			'No label'
		)

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
