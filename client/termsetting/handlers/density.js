import { select, mouse } from 'd3-selection'
import { scaleLinear, drag as d3drag } from 'd3'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins'
import { makeDensityPlot } from '#filter/densityplot'

/*
********************** IMPORTED
	makeDensityPlot(opts) // retrun svg densityplot for given density data
********************** EXPORTED
	setDensityPlot(self)
********************** INTERNAL
	handleNoDensity(self) // if maxvalue is same as minvalue
	renderBinLines() // render binlines on top of densityplot based on term mode
*/

export async function setDensityPlot(self) {
	if (self.num_obj.density_data.maxvalue == self.num_obj.density_data.minvalue) {
		handleNoDensity(self)
		self.num_obj.brushes.forEach(brush => {
			if (brush.range.stop > self.num_obj.density_data.minvalue) brush.init()
		})
	} else {
		// svg for range plot
		const div = self.q.mode == 'spline' ? self.dom.knots_div : self.dom.bins_div
		self.num_obj.svg = div.select('svg').size() ? div.select('svg') : div.append('svg')
		self.num_obj.svg.selectAll('*').remove()
		const density_plot_opts = {
			svg: self.num_obj.svg,
			data: self.num_obj.density_data,
			term: self.term,
			plot_size: self.num_obj.plot_size
		}
		makeDensityPlot(density_plot_opts)

		// add binsize_g for termsetting lines
		self.num_obj.binsize_g = self.num_obj.svg
			.append('g')
			.attr('transform', `translate(${self.num_obj.plot_size.xpad}, ${self.num_obj.plot_size.ypad})`)
			.attr('class', 'binsize_g')

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

	if (!self.num_obj.custom_bins_q) {
		/* when custom_bins_q is undefined, do not run below as a quick fix not to break
		FIXME where is this created and purpose?
		*/
		return
	}

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
				stop: mean_value,
				stopinclusive: true,
				name: 'First bin'
			}
			const last_bin = {
				start: mean_value,
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

function renderBinLines(self, data) {
	const o = self.num_obj
	const scaledMinX = Math.round(o.xscale(o.density_data.minvalue))
	const scaledMaxX = Math.round(o.xscale(o.density_data.maxvalue))
	const lines = []

	if (data.mode == 'discrete' && data.type == 'regular-bin') {
		// assume that boundary lines will be hidden if x > last_bin.start
		// offset max value by first_bin.stop in case the first boundary is dragged
		// to the left, will reveal additional non-draggable boundaries from the right
		const binLinesStop = o.density_data.maxvalue + Math.abs(data.first_bin.stop) - Math.min(o.density_data.minvalue, 0)
		let index = 0
		//
		for (let i = data.first_bin.stop; i <= binLinesStop; i = i + data.bin_size) {
			lines.push({ x: i, index, scaledX: Math.round(o.xscale(i)) })
			index++
		}
		const lastVisibleLine = lines
			.slice()
			.reverse()
			.find(d => d.scaledX <= scaledMaxX)

		if (data.last_bin && data.last_bin.start && data.last_bin.start !== lastVisibleLine.x) {
			lines.push({ x: data.last_bin.start, index, scaledX: Math.round(o.xscale(data.last_bin.start)) })
		}
	} else if ((data.mode == 'discrete' && data.type == 'custom-bin') || data.mode == 'binary') {
		lines.push(
			...data.lst.slice(1).map((d, index) => {
				return { x: d.start, index, scaledX: Math.round(o.xscale(d.start)) }
			})
		)
	} else if (data.mode == 'spline') {
		lines.push(
			...data.knots.map((d, index) => {
				return { x: d.value, index, scaledX: Math.round(o.xscale(d.value)) }
			})
		)
	}

	lines.forEach((d, i) => {
		d.isDraggable =
			self.q.type == 'custom-bin' ||
			self.q.mode == 'spline' ||
			i === 0 ||
			(self.q.last_bin && self.q.last_bin.start === d.x && d.index == lines.length - 1)
	})

	self.num_obj.binsize_g.selectAll('line').remove()
	const lastVisibleLine =
		lines.length == 1
			? lines[0]
			: lines
					.slice()
					.reverse()
					.find(d => d.scaledX < scaledMaxX)
	let lastScaledX = lastVisibleLine ? Math.min(scaledMaxX, lastVisibleLine.scaledX) : scaledMaxX

	self.num_obj.binsize_g
		.selectAll('line')
		.data(lines)
		.enter()
		.append('line')
		.style('stroke', d => (d.isDraggable ? '#cc0000' : '#555'))
		.style('stroke-width', 1)
		.attr('x1', d => d.scaledX)
		.attr('y1', 0)
		.attr('x2', d => d.scaledX)
		.attr('y2', o.plot_size.height)
		.style('cursor', d => (d.isDraggable ? 'ew-resize' : ''))
		.style('display', d => (!d.isDraggable && d.scaledX > lastScaledX ? 'none' : ''))
		.on('mouseover', function(d) {
			if (self.q.type != 'regular-bin' || d.isDraggable) select(this).style('stroke-width', 3)
		})
		.on('mouseout', function(d) {
			select(this).style('stroke-width', 1)
		})
		.each(function(d, i) {
			if (d.isDraggable) {
				const dragger = d3drag()
					.on('drag', dragged)
					.on('end', dragend)
				select(this).call(dragger)
			}
		})

	const middleLines = self.num_obj.binsize_g.selectAll('line').filter((d, i) => !d.isDraggable)

	function dragged(b) {
		const draggedX = mouse(this)[0]
		if (draggedX <= scaledMinX || draggedX >= scaledMaxX) return
		const line =
			self.q.type == 'regular-bin'
				? select(this)
				: b.index > 0 && draggedX <= lines[b.index - 1].scaledX
				? select(this.previousSibling)
				: b.index < lines.length - 1 && draggedX >= lines[b.index + 1].scaledX
				? select(this.nextSibling)
				: select(this)
		const d = line.datum()

		d.draggedX = draggedX
		line
			.attr('x1', d.draggedX)
			.attr('y1', 0)
			.attr('x2', d.draggedX)
			.attr('y2', o.plot_size.height)

		const inverted = +o.xscale.invert(d.draggedX)
		const value = self.term.type == 'integer' ? Math.round(inverted) : inverted.toFixed(3)

		if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
			//d.scaledX = Math.round(o.xscale(value))
			if (d.index === 0) {
				self.dom.first_stop_input.property('value', value)
				self.dom.first_stop_input.restyle()
				const maxX = self.q.last_bin ? lastScaledX : scaledMaxX
				const diff = d.draggedX - d.scaledX
				middleLines.each(function(c, i) {
					c.draggedX = c.scaledX + diff
					select(this)
						.attr('x1', c.draggedX)
						.attr('y1', 0)
						.attr('x2', c.draggedX)
						.attr('y2', o.plot_size.height)
						.style('display', c => (c.draggedX >= maxX ? 'none' : ''))
				})
				self.q.first_bin.stop = value
			} else {
				self.dom.last_start_input.property('value', value)
				self.dom.last_start_input.restyle()
				self.q.last_bin.start = value
				middleLines.style('display', c => (c.scaledX >= d.draggedX ? 'none' : ''))
			}
		} else if ((self.q.mode == 'discrete' && self.q.type == 'custom-bin') || self.q.mode == 'binary') {
			self.q.lst[d.index + 1].start = value
			self.q.lst[d.index + 1].label = get_bin_label(self.q.lst[d.index + 1], self.q)
			self.q.lst[d.index + 1].range = get_bin_range_equation(self.q.lst[d.index + 1], self.q)
			self.q.lst[d.index].stop = value
			self.q.lst[d.index].label = get_bin_label(self.q.lst[d.index], self.q)
			self.q.lst[d.index].range = get_bin_range_equation(self.q.lst[d.index], self.q)
			if (self.dom.customBinBoundaryInput) {
				// this is created by binary.js when mode=binary
				// quick fix: while dragging, revert from percentile to normal, as it's hard to update percentile values
				self.q.modeBinaryCutoffType = 'normal'
				if (self.dom.customBinBoundaryPercentileCheckbox) {
					self.dom.customBinBoundaryPercentileCheckbox.property('checked', false)
				}
				self.dom.customBinBoundaryInput.property(
					'value',
					self.q.lst
						.slice(1)
						.map(d => d.start)
						.join('\n')
				)
			}

			if (self.dom.customBinLabelInput) {
				self.dom.customBinLabelInput.property('value', c => c.label)
			}
			if (self.dom.customBinRanges) {
				self.dom.customBinRanges.html(c => c.range)
			}
		} else if (self.q.mode == 'spline') {
			self.q.knots[d.index].value = value
			if (self.dom.customKnotsInput) {
				self.dom.customKnotsInput.property('value', self.q.knots.map(d => d.value).join('\n'))
			}
		} else {
			throw 'Dragging not allowed for this term type'
		}
	}

	function dragend(b) {
		const draggedX = mouse(this)[0]
		const line =
			self.q.type == 'regular-bin'
				? select(this)
				: b.index > 0 && draggedX <= lines[b.index - 1].scaledX
				? select(this.previousSibling)
				: b.index < lines.length - 1 && draggedX >= lines[b.index + 1].scaledX
				? select(this.nextSibling)
				: select(this)
		const d = line.datum()

		d.scaledX = d.draggedX
		d.x = +o.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
		if (self.q.mode == 'discrete' && self.q.type == 'regular-bin') {
			if (d.index === 0) {
				self.q.first_bin.stop = d.x
				middleLines.each(function(d, i) {
					d.scaledX = d.draggedX
					d.x = +o.xscale.invert(d.draggedX).toFixed(self.term.type == 'integer' ? 0 : 3)
				})
			} else {
				self.q.last_bin.start = d.x
			}
			lastScaledX = lines
				.slice()
				.reverse()
				.find(d => d.scaledX < scaledMaxX).scaledX
		} else if (self.q.mode == 'discrete' && self.q.type == 'custom-bin') {
			self.q.lst[d.index + 1].start = d.x
			self.q.lst[d.index].stop = d.x
		} else if (self.q.mode == 'spline') {
			self.q.knots[d.index].value = d.x
		}
	}
}
