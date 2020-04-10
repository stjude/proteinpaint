import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, drag as d3drag, transform } from 'd3'

export async function setDensityPlot(self) {
	if (self.num_obj.density_data.maxvalue == self.num_obj.density_data.minvalue) {
		handleNoDensity(self)
		self.num_obj.brushes.forEach(brush => {
			if (brush.range.stop > self.num_obj.density_data.minvalue) brush.init()
		})
	} else {
		// svg for range plot
		const div = self.dom.bins_div
		self.num_obj.svg = div.append('svg')
		makeDensityPlot(self)

		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		self.num_obj.xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

		self.num_obj.ranges = []
		if (self.q.first_bin) {
			self.num_obj.ranges.push(self.q.first_bin)
			self.num_obj.ranges[0].bin = 'first'
		}
		if (self.q.last_bin) {
			self.num_obj.ranges.push(self.q.last_bin)
			self.num_obj.ranges[1].bin = 'last'
		}
		self.num_obj.brushes = []
		renderBinLines(self, self.q)
	}

	self.renderBinLines = renderBinLines
}

function handleNoDensity(self) {
	self.num_obj.no_density_data = true
	self.num_obj.ranges = []
	if (self.q.first_bin) {
		self.num_obj.ranges.push(self.q.first_bin)
		self.num_obj.ranges[0].bin = 'first'
	}
	if (self.q.last_bin) {
		self.num_obj.ranges.push(self.q.last_bin)
		self.num_obj.ranges[1].bin = 'last'
	}
	self.num_obj.brushes = []
	const brushes = self.num_obj.brushes

	for (const [i, r] of self.num_obj.ranges.entries()) {
		const _b = brushes.find(b => b.orig === r)
		let brush
		if (!_b) {
			brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
			brushes.push(brush)
		} else {
			brush = _b
		}

		const custom_bins_q = self.num_obj.custom_bins_q
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		const custom_bins = custom_bins_q.lst || []

		if (custom_bins.length == 0) {
			const mean_value = (maxvalue + minvalue) / 2
			const first_bin = {
				startunbounded: true,
				stop: Math.round(mean_value),
				stopinclusive: true,
				name: 'First bin'
			}
			const last_bin = {
				start: Math.round(mean_value),
				stopunbounded: true,
				startinclusive: false,
				name: 'Last bin'
			}
			custom_bins.push(first_bin)
			custom_bins.push(last_bin)
			self.num_obj.custom_bins_q.lst = custom_bins
		}
	}
}

function makeDensityPlot(self) {
	const svg = self.num_obj.svg
	const data = self.num_obj.density_data

	const width = 500,
		height = 100,
		xpad = 10,
		ypad = 20,
		xaxis_height = 20

	svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)

	//density data, add first and last values to array
	const density_data = data.density
	density_data.unshift([data.minvalue, 0])
	density_data.push([data.maxvalue, 0])

	// x-axis
	const xscale = scaleLinear()
		.domain([data.minvalue, data.maxvalue])
		.range([xpad, width - xpad])

	const x_axis = axisBottom().scale(xscale)

	// y-scale
	const yscale = scaleLinear()
		.domain([0, data.densitymax])
		.range([height + ypad, ypad])

	const g = svg.append('g').attr('transform', `translate(${xpad}, 0)`)

	// SVG line generator
	const line = d3line()
		.x(function(d) {
			return xscale(d[0])
		})
		.y(function(d) {
			return yscale(d[1])
		})
		.curve(curveMonotoneX)

	// plot the data as a line
	g.append('path')
		.datum(density_data)
		.attr('class', 'line')
		.attr('d', line)
		.style('fill', '#eee')
		.style('stroke', '#000')

	g.append('g')
		.attr('transform', `translate(0, ${ypad + height})`)
		.call(x_axis)

	g.append('text')
		.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
		.attr('font-size', '13px')
		.text(self.term.unit)

	self.num_obj.brush_g = svg
		.append('g')
		.attr('class', 'brush_g')
		.attr('transform', `translate(${xpad}, ${ypad})`)

	self.num_obj.binsize_g = svg
		.append('g')
		.attr('class', 'binsize_g')
		.attr('transform', `translate(${xpad}, ${ypad})`)

	self.num_obj.custombins_g = svg
		.append('g')
		.attr('class', 'custombins_g')
		.attr('transform', `translate(${xpad}, ${ypad})`)
		.style('display', 'none')
}

function renderBinLines(self, data) {
	const o = self.num_obj
	const lines = []
	if (data.type == 'regular') {
		const binLinesStop = data.last_bin ? data.last_bin.start : o.density_data.maxvalue
		let index = 0
		for (let i = data.first_bin.stop; i <= binLinesStop; i = i + data.bin_size) {
			lines.push({x: i, index, scaledX: Math.round(o.xscale(i))})
			index++
		}
	} else {
		lines.push( ... data.lst.slice(1).map((d,index)=>{return {x: d.start, index, scaledX: Math.round(o.xscale(d.start))}}))
	}

	self.num_obj.binsize_g.selectAll('line').remove()

	self.num_obj.binsize_g
		.selectAll('line')
		.data(lines)
		.enter()
		.append('line')
		.style('stroke', '#cc0000')
		.style('stroke-width', 1)
		.attr('x1', d => d.scaledX)
		.attr('y1', 0)
		.attr('x2', d => d.scaledX)
		.attr('y2', o.plot_size.height)
		.attr('cursor', function(d,i){
			return self.q.type == 'custom' || i===0 || i === lines.length - 1 ? 'ew-resize' : ''
		})
		.each(function(d,i){
			if (self.q.type == 'custom' || i===0 || i === lines.length - 1) select(this).call( d3drag().on('drag', dragged))
		})

	function dragged(d) {
		const line = select(this)
		d.draggedX = d.scaledX + event.x
		line
			.attr('x1', d.draggedX)
			.attr('y1', 0)
			.attr('x2', d.draggedX)
			.attr('y2', o.plot_size.height)

		const value = o.xscale.invert(d.draggedX).toFixed(3)
		if (self.q.type == 'regular') {
			if (d.index === 0) self.dom.first_stop_input.property('value', value)
			else self.dom.last_start_input.property('value', value)
		} else {
			self.q.lst[d.index + 1].start = value
			self.dom.customBinBoundaryInput.property('value',self.q.lst.slice(1).map(d=>d.start).join('\n'))
		}
	}
}


