import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { rgb, brushX, axisTop } from 'd3'

export class violinRenderer {
	constructor(holder, plot, callback = null, scaleFactor = 1, width = 500, height = 100, shift = 20) {
		this.holder = holder
		this.plot = plot
		this.width = width
		this.height = height
		this.callback = callback
		this.shift = shift
		this.svg = holder
			.append('svg')
			.attr('width', `${width + 50}px`)
			.attr('height', `${height + 50}px`)
		this.axisScale = scaleLinear().domain([plot.minvalue, plot.maxvalue]).range([0, width])
		this.axisScaleUI = scaleLinear()
			.domain([plot.minvalue * scaleFactor, plot.maxvalue * scaleFactor])
			.range([0, width])

		this.wScale = scaleLinear()
			.domain([plot.densityMax, 0])
			.range([height * 0.45, 0])
	}

	render() {
		this.svg.selectAll('*').remove()
		this.violinG = this.svg.append('g').attr('transform', `translate(${this.shift}, ${this.height / 2 + this.shift})`)

		this.scaleG = this.svg.append('g').attr('transform', `translate(${this.shift}, ${this.shift})`)
		this.scaleG.call(axisTop(this.axisScaleUI).tickValues(this.axisScaleUI.ticks()))
		this.renderArea(false)
		this.renderArea(true)
		if (this.plot.valuesImg)
			this.violinG
				.append('image')
				.classed('sjpp-beans-img', true)
				.attr('xlink:href', this.plot.valuesImg)
				.attr('transform', `translate(0, -${this.plot.radius || 3})`)

		if (this.callback)
			this.svg.call(
				brushX()
					.extent([
						[this.shift, this.shift],
						[this.width + this.shift, this.height + this.shift]
					])
					.on('end', async event => {
						const selection = event.selection
						const range_start = this.axisScale.invert(selection[0])
						const range_end = this.axisScale.invert(selection[1])
						this.callback({ range_start, range_end })
					})
			)
	}

	renderArea(invert) {
		if (this.plot.densityMax == 0) return
		const areaBuilder = line()
			.curve(curveMonotoneX)
			.x(d => this.axisScale(d.x0))
			.y(d => (invert ? -this.wScale(d.density) : this.wScale(d.density)))

		this.violinG
			.append('path')
			//.attr('class', 'sjpp-vp-path')
			.style('fill', this.plot.color || rgb(221, 221, 221))
			.style('opacity', 0)
			.attr('stroke', rgb(this.plot.color).darker())
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			.style('opacity', '0.8')
			.attr('d', areaBuilder(this.plot.density))
	}
}
