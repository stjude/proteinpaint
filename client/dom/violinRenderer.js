import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { axisBottom, axisTop, rgb } from 'd3'

export class violinRenderer {
	constructor(holder, plot, width = 350, height = 150) {
		this.holder = holder
		this.plot = plot
		this.width = width
		this.height = height
		this.svg = holder
			.append('svg')
			.attr('width', `${width + 50}px`)
			.attr('height', `${height + 50}px`)
		holder.style('margin', '20px')
		this.scaleG = this.svg.append('g').attr('transform', `translate(20, ${height})`)
		this.violinG = this.svg.append('g').attr('transform', `translate(20, ${height / 2})`)
		this.axisScale = scaleLinear().domain([plot.minvalue, plot.maxvalue]).range([0, width])
		this.scaleG.call(axisBottom(this.axisScale).tickValues(this.axisScale.ticks()))

		this.wScale = scaleLinear()
			.domain([plot.densityMax, 0])
			.range([height * 0.45, 0])
		this.areaBuilder = line()
			.curve(curveMonotoneX)
			.x(d => this.axisScale(d.x0))
			.y(d => this.wScale(d.density))
	}

	render() {
		this.renderArea(false)
		this.renderArea(true)
	}

	renderArea(invert) {
		if (this.plot.densityMax == 0) return
		const areaBuilder = this.areaBuilder
		if (invert) areaBuilder.y(d => -this.wScale(d.density))
		this.violinG
			.append('path')
			.attr('class', 'sjpp-vp-path')
			.style('fill', this.plot.color || rgb(221, 221, 221))
			.style('opacity', 0)
			.attr('stroke', rgb(this.plot.color).darker())
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			.style('opacity', '0.8')
			.attr('d', areaBuilder(this.plot.density))
	}
}
