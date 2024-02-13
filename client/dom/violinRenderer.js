import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { axisBottom, rgb, brushX } from 'd3'

export class violinRenderer {
	constructor(holder, plot, callback = null, scaleFactor = 1, width = 500, height = 100) {
		this.holder = holder
		this.plot = plot
		this.width = width
		this.height = height
		this.shift = 20
		this.callback = callback
		this.svg = holder
			.append('svg')
			.attr('width', `${width + 50}px`)
			.attr('height', `${height + 50}px`)
		holder.style('margin', `${this.shift}px`)
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
		this.violinG = this.svg.append('g').attr('transform', `translate(20, ${this.height / 2})`)

		this.scaleG = this.svg.append('g').attr('transform', `translate(20, ${this.height})`)
		this.scaleG.call(axisBottom(this.axisScaleUI).tickValues(this.axisScaleUI.ticks()))
		this.renderArea(false)
		this.renderArea(true)
		if (this.callback)
			this.svg.call(
				brushX()
					.extent([
						[0, 0],
						[this.width, this.height]
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
