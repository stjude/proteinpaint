import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, brushX, drag as d3drag, transform } from 'd3'

export async function setDensityPlot(self) {
	if (self.num_obj.density_data.maxvalue == self.num_obj.density_data.minvalue) {
		handleNoDensity(self)
		self.num_obj.brushes.forEach(brush => {
			if (brush.range.stop > self.num_obj.density_data.minvalue) brush.init()
		})
	} else {
		// svg for range plot
		self.num_obj.svg = div.append('svg')
		self.makeDensityPlot()

		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		self.num_obj.xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

		self.num_obj.ranges = []
		if (self.num_obj.custom_bins_q.first_bin) {
			self.num_obj.ranges.push(self.num_obj.custom_bins_q.first_bin)
			self.num_obj.ranges[0].bin = 'first'
		}
		if (self.num_obj.custom_bins_q.last_bin) {
			self.num_obj.ranges.push(self.num_obj.custom_bins_q.last_bin)
			self.num_obj.ranges[1].bin = 'last'
		}
		self.num_obj.brushes = []
		self.addBrushes()
		self.addBinSizeLines()
		self.addCustomBinLines()
	}		
}

function handleNoDensity(self) {
	self.num_obj.no_density_data = true
	self.num_obj.ranges = []
	if (self.num_obj.custom_bins_q.first_bin) {
		self.num_obj.ranges.push(self.num_obj.custom_bins_q.first_bin)
		self.num_obj.ranges[0].bin = 'first'
	}
	if (self.num_obj.custom_bins_q.last_bin) {
		self.num_obj.ranges.push(self.num_obj.custom_bins_q.last_bin)
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

function addBrushes(self) {
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
	}

	const range_brushes = self.num_obj.brush_g.selectAll('.range_brush').data(brushes, d => brushes.indexOf(d))

	range_brushes.exit().remove()

	// add update to brush if required
	range_brushes.each(function(d, i) {
		select(this)
			.selectAll('.overlay')
			.style('pointer-events', 'all')
	})

	range_brushes
		.enter()
		.append('g')
		.attr('class', 'range_brush')
		.each(self.applyBrush)
}

function applyBrush(self, brush) {
	if (!brush.elem) brush.elem = select(this)
	const range = brush.range
	const plot_size = self.num_obj.plot_size
	const xpad = plot_size.xpad
	const ypad = plot_size.ypad
	const xscale = self.num_obj.xscale
	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue
	let brush_drag_start, cursor_style

	brush.d3brush = brushX()
		.extent([[plot_size.xpad, 0], [plot_size.width - plot_size.xpad, plot_size.height]])
		.on('start', function() {
			cursor_style = event.sourceEvent && event.sourceEvent.target && select(event.sourceEvent.target).attr('cursor')
			if (self.num_obj.custom_bins_q.type == 'regular') {
				brush.elem.selectAll('.selection').attr('pointer-events', 'none')
				if (cursor_style == 'default') return
			}

			const orig_val = self.num_obj.brushes[0].orig.stop
			const range_val = self.num_obj.brushes[0].range.stop
			brush_drag_start = orig_val == range_val ? Number(orig_val) : Number(range_val)

			brush.elem
				.selectAll('.selection')
				.attr('cursor', 'default')
				.attr('pointer-events', '')
			if (brush.orig.bin == 'first') brush.elem.selectAll('.handle--w').attr('pointer-events', 'none')
			else if (brush.orig.bin == 'last') brush.elem.selectAll('.handle--e').attr('pointer-events', 'none')
		})
		.on('brush', function() {
			if (self.num_obj.custom_bins_q.type == 'regular') {
				brush.elem.selectAll('.selection').attr('pointer-events', 'none')
				if (cursor_style == 'default') return
			} else {
				brush.elem.selectAll('.selection').attr('pointer-events', '')
			}

			const s = event.selection
			const start_s = range.bin == 'first' ? s[1] : xscale(brush_drag_start)
			//update temp_ranges
			range.start = Number(xscale.invert(s[0]).toFixed(1))
			range.stop = Number(xscale.invert(s[1]).toFixed(1))
			const a_range = JSON.parse(JSON.stringify(brush.orig))
			if (range.startunbounded) a_range.start = Number(minvalue.toFixed(1))
			if (range.stopunbounded) a_range.stop = Number(maxvalue.toFixed(1))
			const similarRanges = JSON.stringify(range) == JSON.stringify(a_range)

			// update inputs from brush move
			if (brush.orig.bin == 'first') {
				select(brush.input._groups[0][0]).style('color', a_range.stop == range.stop ? '#000' : '#23cba7')
				brush.input._groups[0][0].value = range.stop
			} else if (brush.orig.bin == 'last') {
				select(brush.input._groups[0][0]).style('color', a_range.start == range.start ? '#000' : '#23cba7')
				brush.input._groups[0][0].value = range.start
			}

			// //update 'apply' and 'reset' buttons based on brush change
			self.num_obj.reset_btn.style('display', similarRanges && !self.bins_customized() ? 'none' : 'inline-block')

			// make brush green if changed
			brush.elem.selectAll('.selection').style('fill', !similarRanges ? '#23cba7' : '#777777')
			//move lines_g with brush move
			self.num_obj.binsize_g.attr('transform', `translate(${start_s - xscale(brush_drag_start) + xpad}, ${ypad})`)
		})
		.on('end', function() {
			//diable pointer-event for multiple brushes
			brush.elem.selectAll('.overlay').style('pointer-events', 'none')
			if (brush.orig.bin == 'first') {
				self.num_obj.brushes[0].range.stop = range.stop
			}
		})

	const brush_start = range.startunbounded ? minvalue : range.start
	const brush_stop = range.stopunbounded ? maxvalue : range.stop
	brush.init = () => brush.elem.call(brush.d3brush).call(brush.d3brush.move, [brush_start, brush_stop].map(xscale))

	if (range.startunbounded) delete range.start
	if (range.stopunbounded) delete range.stop
	brush.elem
		.selectAll('.selection')
		.style(
			'fill',
			(brush.orig.start == '' && brush.orig.stop == '') || JSON.stringify(range) != JSON.stringify(brush.orig)
				? '#23cba7'
				: '#777777'
		)
}

function addBinSizeLines(self) {
	const custom_bins_q = self.num_obj.custom_bins_q
	const default_bins_q = self.num_obj.default_bins_q
	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue

	const bin_size = self.bins_customized() ? custom_bins_q.bin_size : default_bins_q.bin_size
	const plot_size = self.num_obj.plot_size
	const xscale = self.num_obj.xscale
	const end_bins = self.num_obj.ranges
	const first_bin = self.num_obj.brushes[0].range
	const first_bin_orig = JSON.parse(JSON.stringify(self.num_obj.brushes[0].orig))
	const last_bin = self.num_obj.brushes[1] ? self.num_obj.brushes[1].range : undefined
	const line_x = []
	const binLinesStop = last_bin ? last_bin.start : maxvalue

	for (let i = first_bin.stop; i <= binLinesStop; i = i + bin_size) {
		line_x.push(i)
	}

	self.num_obj.binsize_g.selectAll('line').remove()

	self.num_obj.binsize_g
		.selectAll('line')
		.data(line_x)
		.enter()
		.append('line')
		.style('stroke', '#cc0000')
		.style('stroke-width', 1)
		.attr('x1', d => xscale(d))
		.attr('y1', 0)
		.attr('x2', d => xscale(d))
		.attr('y2', plot_size.height)

	self.num_obj.binsize_g.attr('transform', `translate(${plot_size.xpad}, ${plot_size.ypad})`)
}

function addCustomBinLines(self) {
	const plot_size = self.num_obj.plot_size
	const custom_bins_q = self.num_obj.custom_bins_q
	const default_bins_q = self.num_obj.default_bins_q
	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue

	const custom_bins = custom_bins_q.lst || []
	const xscale = self.num_obj.xscale
	const line_x = []
	// const binLinesStop = last_bin ? last_bin.start : maxvalue

	if (custom_bins.length == 0) {
		const mean_value = (maxvalue + minvalue) / 2
		const first_bin = { startunbounded: true, stop: Math.round(mean_value), stopinclusive: true, name: 'First bin' }
		const last_bin = { start: Math.round(mean_value), stopunbounded: true, startinclusive: false, name: 'Last bin' }
		custom_bins.push(first_bin)
		custom_bins.push(last_bin)
		self.num_obj.custom_bins_q.lst = custom_bins
	}

	for (let i = 0; i < custom_bins.length - 1; i++) {
		line_x.push(custom_bins[i].stop)
	}

	self.num_obj.custombins_g.selectAll('line').remove()

	const drag = d3drag()
		.on('start', dragstarted)
		.on('drag', dragged)
		.on('end', dragended)

	const lines = self.num_obj.custombins_g
		.selectAll('line')
		.data(line_x)
		.enter()
		.append('line')
		.attr('class', 'custom_line')
		.style('stroke', '#cc0000')
		.style('stroke-width', 1)
		.attr('x1', d => xscale(d))
		.attr('y1', 0)
		.attr('x2', d => xscale(d))
		.attr('y2', plot_size.height)
		.call(drag)
		.on('mouseover', (d, i) => {
			select(self.num_obj.custombins_g.node().querySelectorAll('line')[i]).style('stroke-width', 3)
		})
		.on('mouseout', (d, i) => {
			select(self.num_obj.custombins_g.node().querySelectorAll('line')[i]).style('stroke-width', 1)
		})

	function dragstarted() {
		select(this).style('cursor', 'pointer')
	}

	function dragged() {
		const x = event.x

		const line = select(this)
		line
			.attr('x1', x)
			.attr('y1', 0)
			.attr('x2', x)
			.attr('y2', plot_size.height)
	}

	function dragended(d, i) {
		select(this).style('cursor', 'default')
		custom_bins[i].stop = xscale(event.x)
	}
}